# backend/routes/reservations.py
from flask import Blueprint, request, jsonify
from models import db, User, Tool, Reservation, RolePermission, Permission
from datetime import datetime, timedelta
from dateutil.parser import isoparse
from pytz import timezone
import pytz
from utils.permissions import get_token_payload

reservation_bp = Blueprint("reservations", __name__)


# -----------------------------
# Helpers
# -----------------------------
def _recompute_tool_borrowed(tool_id: int):
    """Setzt Tool.is_borrowed basierend auf aktiver Reservation (Stand: jetzt) neu."""
    if not tool_id:
        return
    now_utc = datetime.utcnow()
    tool = Tool.query.get(tool_id)
    if not tool:
        return
    active = Reservation.query.filter(
        Reservation.tool_id == tool_id,
        Reservation.start_time <= now_utc,
        Reservation.end_time >= now_utc,
    ).first()
    tool.is_borrowed = bool(active)


def _role_value_for(user_id, perm_key):
    """Gibt 'true' | 'self_only' | 'false' für eine Permission zurück."""
    if not user_id:
        return "false"
    perm = Permission.query.filter_by(key=perm_key).first()
    user = User.query.get(user_id)
    if not perm or not user:
        return "false"
    rp = RolePermission.query.filter_by(
        role_id=user.role_id, permission_id=perm.id
    ).first()
    return rp.value if rp else "false"


def _parse_to_utc(val):
    """Akzeptiert ISO (mit oder ohne Z) und liefert naive UTC-Datetime."""
    zurich = timezone("Europe/Zurich")
    try:
        dt = isoparse(str(val))
        if dt.tzinfo is None:
            # lokale Zeit (z. B. "2025-10-14 08:00")
            dt = zurich.localize(dt)
        return dt.astimezone(pytz.utc).replace(tzinfo=None)
    except Exception:
        raise ValueError("Ungültiges Zeitformat")


def _purge_old_reservations():
    now_utc = datetime.utcnow()
    threshold = now_utc - timedelta(days=90)
    expired = Reservation.query.filter(Reservation.end_time < threshold).all()
    if not expired:
        return 0
    affected_tool_ids = set(r.tool_id for r in expired)
    for r in expired:
        db.session.delete(r)
    db.session.flush()
    for tid in affected_tool_ids:
        _recompute_tool_borrowed(tid)
    db.session.commit()
    return len(expired)


# -----------------------------
# Reservation anlegen
# -----------------------------
@reservation_bp.route("", methods=["POST"])
def create_reservation():
    data = request.get_json() or {}
    payload = get_token_payload()
    user_id = payload["user_id"] if payload else None

    # 1. Prüfen, ob QR-Modus (klassisch)
    user_code = data.get("user")
    tool_code = data.get("tool")
    duration = int(data.get("duration") or 0)

    # 2. Oder manuelle Reservation
    user_id_direct = data.get("user_id")
    tool_id_direct = data.get("tool_id")
    start_time_str = data.get("start_time")
    end_time_str = data.get("end_time")

    zurich = timezone("Europe/Zurich")

    # -------------------------
    # A) Manuelle Reservation
    # -------------------------
    if user_id_direct and tool_id_direct and start_time_str and end_time_str:
        # Berechtigungsprüfung
        if not user_id:
            return jsonify({"error": "Login erforderlich"}), 401

        val = _role_value_for(user_id, "create_reservations")
        if val == "false":
            return jsonify({"error": "Keine Berechtigung für Reservation"}), 403

        try:
            start_local = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
            end_local = datetime.fromisoformat(end_time_str.replace("Z", "+00:00"))
            if start_local.tzinfo is None:
                start_local = zurich.localize(start_local)
            if end_local.tzinfo is None:
                end_local = zurich.localize(end_local)
            start_utc = start_local.astimezone(pytz.utc).replace(tzinfo=None)
            end_utc = end_local.astimezone(pytz.utc).replace(tzinfo=None)
        except Exception:
            return jsonify({"error": "Ungültige Datumsangabe"}), 400

        if start_utc >= end_utc:
            return jsonify({"error": "Endzeit muss nach Startzeit liegen"}), 400

        user = User.query.get(user_id_direct)
        tool = Tool.query.get(tool_id_direct)
        if not user or not tool:
            return jsonify({"error": "Benutzer oder Werkzeug nicht gefunden"}), 404

        # Überschneidungen prüfen
        overlap = Reservation.query.filter(
            Reservation.tool_id == tool.id,
            Reservation.start_time < end_utc,
            Reservation.end_time > start_utc,
        ).first()
        if overlap:
            return (
                jsonify(
                    {
                        "error": f"Werkzeug '{tool.name}' ist in diesem Zeitraum bereits reserviert."
                    }
                ),
                400,
            )

        reservation = Reservation(
            user=user, tool=tool, start_time=start_utc, end_time=end_utc, confirmed=True
        )
        db.session.add(reservation)
        db.session.flush()
        _recompute_tool_borrowed(tool.id)
        db.session.commit()

        return jsonify({"message": "Manuelle Reservation gespeichert"}), 201

    # -------------------------
    # B) QR-Modus
    # -------------------------
    if not user_code or not tool_code or not duration:
        return jsonify({"error": "Missing fields"}), 400

    if user_id:
        val = _role_value_for(user_id, "create_reservations")
        if val == "false":
            return jsonify({"error": "Keine Berechtigung für Reservation"}), 403
    else:
        if not str(user_code).startswith("usr"):
            return jsonify({"error": "Nur QR-Scan erlaubt ohne Login"}), 401

    user = User.query.filter_by(qr_code=user_code).first()
    if not user:
        user = User(qr_code=user_code, username=user_code)
        db.session.add(user)

    tool = Tool.query.filter_by(qr_code=tool_code).first()
    if not tool:
        tool = Tool(qr_code=tool_code, name=tool_code)
        db.session.add(tool)
        db.session.flush()

    now_local = datetime.now(zurich)
    start_local = now_local
    end_local = now_local.replace(
        hour=23, minute=59, second=0, microsecond=0
    ) + timedelta(days=duration - 1)

    start_time = start_local.astimezone(pytz.utc).replace(tzinfo=None)
    end_time = end_local.astimezone(pytz.utc).replace(tzinfo=None)

    # >>> Konflikte prüfen
    conflict = Reservation.query.filter(
        Reservation.tool_id == tool.id,
        Reservation.start_time < end_time,
        Reservation.end_time > start_time,
    ).first()
    if conflict:
        return jsonify({"error": "Werkzeug ist aktuell oder bald reserviert"}), 400

    # >>> Reservation speichern
    reservation = Reservation(
        user=user, tool=tool, start_time=start_time, end_time=end_time
    )
    db.session.add(reservation)
    db.session.flush()
    _recompute_tool_borrowed(tool.id)
    db.session.commit()

    return jsonify({"message": "Reservation gespeichert"}), 201


# -----------------------------
# Reservationen abfragen
# → nur aktive/kommende zurückgeben
# → beim Laden gleichzeitig abgelaufene aufräumen
# -----------------------------
@reservation_bp.route("", methods=["GET"])
def get_reservations():
    _purge_old_reservations()

    to_zone = timezone("Europe/Zurich")
    now_utc = datetime.utcnow()

    reservations = Reservation.query.order_by(Reservation.start_time.desc()).all()

    result = []
    for res in reservations:
        start_local = res.start_time.replace(tzinfo=pytz.utc).astimezone(to_zone)
        end_local = res.end_time.replace(tzinfo=pytz.utc).astimezone(to_zone)
        result.append(
            {
                "id": res.id,
                "start": start_local.strftime("%Y-%m-%d %H:%M"),
                "end": end_local.strftime("%Y-%m-%d %H:%M"),
                "note": getattr(res, "note", None),
                "user": {
                    "id": res.user.id,
                    "username": res.user.username,
                    "first_name": res.user.first_name,
                    "last_name": res.user.last_name,
                },
                "tool": {
                    "id": res.tool.id,
                    "name": res.tool.name or res.tool.qr_code,
                    "qr_code": res.tool.qr_code,
                },
            }
        )
    resp = jsonify(result)
    resp.headers["Cache-Control"] = "no-store"
    return resp, 200


# -----------------------------
# Reservation bearbeiten (PATCH)
# -----------------------------
@reservation_bp.route("/<int:res_id>", methods=["PATCH"])
def update_reservation(res_id):
    data = request.get_json() or {}
    payload = get_token_payload()
    user_id = payload["user_id"] if payload else None

    res = Reservation.query.get_or_404(res_id)

    val = _role_value_for(user_id, "edit_reservations")
    if val == "false" or not user_id:
        return jsonify({"error": "Keine Berechtigung"}), 403
    if val == "self_only" and res.user_id != user_id:
        return jsonify({"error": "Nur eigene Reservationen bearbeitbar"}), 403

    changed = False

    if "start_time" in data and data["start_time"]:
        try:
            new_start = _parse_to_utc(data["start_time"])
            if new_start and res.start_time != new_start:
                res.start_time = new_start
                changed = True
        except Exception:
            return jsonify({"error": "Invalid start_time"}), 400

    if "end_time" in data and data["end_time"]:
        try:
            new_end = _parse_to_utc(data["end_time"])
            if new_end and res.end_time != new_end:
                res.end_time = new_end
                changed = True
        except Exception:
            return jsonify({"error": "Invalid end_time"}), 400

    if "note" in data:
        if getattr(res, "note", None) != data["note"]:
            setattr(res, "note", data["note"])
            changed = True

    if not changed:
        return jsonify({"message": "Keine Änderungen"}), 200

    # Prüfen: Konflikt mit anderen Reservationen für dasselbe Werkzeug?
    conflict = Reservation.query.filter(
        Reservation.tool_id == res.tool_id,
        Reservation.id != res.id,
        Reservation.start_time < res.end_time,
        Reservation.end_time > res.start_time,
    ).first()

    if conflict:
        return (
            jsonify({"error": "Werkzeug ist in diesem Zeitraum bereits reserviert."}),
            400,
        )

    # Sonst normal speichern + Tool-Status konsistent
    db.session.flush()
    _recompute_tool_borrowed(res.tool_id)
    db.session.commit()

    return (
        jsonify(
            {
                "id": res.id,
                "start_time": res.start_time.replace(tzinfo=pytz.utc).isoformat(),
                "end_time": res.end_time.replace(tzinfo=pytz.utc).isoformat(),
                "note": getattr(res, "note", None),
            }
        ),
        200,
    )


# -----------------------------
# Reservation löschen (DELETE)
# -----------------------------
@reservation_bp.route("/<int:res_id>", methods=["DELETE"])
def delete_reservation(res_id):
    payload = get_token_payload()
    user_id = payload["user_id"] if payload else None
    if not user_id:
        return jsonify({"error": "Keine Berechtigung"}), 403

    res = Reservation.query.get_or_404(res_id)

    val = _role_value_for(user_id, "edit_reservations")
    if val == "false":
        return jsonify({"error": "Keine Berechtigung"}), 403
    if val == "self_only" and res.user_id != user_id:
        return jsonify({"error": "Nur eigene Reservationen löschbar"}), 403

    tool_id = res.tool_id
    db.session.delete(res)
    db.session.flush()
    _recompute_tool_borrowed(tool_id)
    db.session.commit()

    return jsonify({"message": "Reservation gelöscht"}), 200


# -----------------------------
# Werkzeug zurückgeben
# -----------------------------
@reservation_bp.route("/return-tool", methods=["PATCH", "POST"])
def return_tool():
    """Werkzeug zurückgeben – setzt Endzeit auf jetzt, aber nur wenn aktuell ausgeliehen."""
    try:
        payload = get_token_payload()
        user_id = payload["user_id"] if payload else None
    except Exception:
        user_id = None

    # Eingabedaten lesen (JSON oder Form)
    data = request.get_json(silent=True) or request.form or {}
    tool_code = data.get("tool", "").strip().lower()
    if not tool_code:
        return jsonify({"error": "Missing tool code"}), 400

    tool = Tool.query.filter_by(qr_code=tool_code).first()
    if not tool:
        return jsonify({"error": "Tool not found"}), 404

    now_utc = datetime.utcnow()

    # Aktive Reservation suchen
    active_res = (
        Reservation.query.filter(Reservation.tool_id == tool.id)
        .filter(Reservation.start_time <= now_utc)
        .filter(Reservation.end_time > now_utc)
        .order_by(Reservation.start_time.desc())
        .first()
    )

    # Berechtigungen prüfen (nur wenn eingeloggter User)
    if user_id:
        val = _role_value_for(user_id, "edit_reservations")
        if val == "false":
            return jsonify({"error": "Keine Berechtigung"}), 403
        if val == "self_only" and active_res and active_res.user_id != user_id:
            return (
                jsonify({"error": "Keine Berechtigung für fremde Reservationen"}),
                403,
            )

    if active_res:
        # Rückgabe durchführen
        active_res.end_time = now_utc
        db.session.flush()
        _recompute_tool_borrowed(tool.id)
        db.session.commit()
        return (
            jsonify({"message": "✅ Werkzeug zurückgegeben (Endzeit aktualisiert)"}),
            200,
        )

    # Keine aktive Reservation – Rückgabe abbrechen
    return (
        jsonify({"error": "Dieses Werkzeug ist aktuell nicht ausgeliehen."}),
        400,
    )
