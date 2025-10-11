# backend/routes/reservations.py
from flask import Blueprint, request, jsonify
from models import db, User, Tool, Reservation, RolePermission, Permission
from datetime import datetime, timedelta
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
    rp = RolePermission.query.filter_by(role_id=user.role_id, permission_id=perm.id).first()
    return rp.value if rp else "false"

def _parse_to_utc(val):
    """Akzeptiert ISO (mit/ohne Z) oder 'YYYY-mm-dd HH:MM' (lokal) und liefert naive UTC-datetime."""
    zurich = timezone("Europe/Zurich")
    try:
        dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = zurich.localize(dt)
        return dt.astimezone(pytz.utc).replace(tzinfo=None)
    except Exception:
        try:
            dt = datetime.strptime(val, "%Y-%m-%d %H:%M")
            dt = zurich.localize(dt)
            return dt.astimezone(pytz.utc).replace(tzinfo=None)
        except Exception:
            raise

def _purge_expired_reservations():
    """Löscht alle Reservationen mit end_time < jetzt und setzt betroffene Tools korrekt."""
    now_utc = datetime.utcnow()
    expired = Reservation.query.filter(Reservation.end_time < now_utc).all()
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
    user_code = data.get("user")
    tool_code = data.get("tool")
    duration = int(data.get("duration") or 0)

    if not user_code or not tool_code or not duration:
        return jsonify({"error": "Missing fields"}), 400

    payload = get_token_payload()
    user_id = payload["user_id"] if payload else None

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

    now_utc = datetime.utcnow()
    conflict = Reservation.query.filter(
        Reservation.tool_id == tool.id,
        Reservation.end_time >= now_utc,  # aktiv oder geplant
    ).first()
    if conflict:
        return jsonify({"error": "Werkzeug ist aktuell oder bald reserviert"}), 400

    zurich = timezone("Europe/Zurich")
    now_local = datetime.now(zurich)
    end_local = now_local.replace(hour=23, minute=59, second=0, microsecond=0) + timedelta(days=duration - 1)

    start_time = now_local.astimezone(pytz.utc)
    end_time = end_local.astimezone(pytz.utc)

    reservation = Reservation(user=user, tool=tool, start_time=start_time, end_time=end_time)
    db.session.add(reservation)

    db.session.flush()
    _recompute_tool_borrowed(tool.id)
    db.session.commit()

    return jsonify({"message": "Reservation saved"}), 201

# -----------------------------
# Reservationen abfragen
# → nur aktive/kommende zurückgeben
# → beim Laden gleichzeitig abgelaufene aufräumen
# -----------------------------
@reservation_bp.route("", methods=["GET"])
def get_reservations():
    # Aufräumen: abgelaufene löschen (damit “Auto-Delete nach Ablauf” greift)
    _purge_expired_reservations()

    to_zone = timezone("Europe/Zurich")
    now_utc = datetime.utcnow()

    # Nur aktive/kommende Reservationen für den Kalender
    reservations = Reservation.query.filter(
        Reservation.end_time >= now_utc
    ).order_by(Reservation.start_time.desc()).all()

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
# - bei Änderung ins Vergangene: löschen statt behalten
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

    # Wenn jetzt in der Vergangenheit: löschen
    now_utc = datetime.utcnow()
    if res.end_time < now_utc:
        tool_id = res.tool_id
        db.session.delete(res)
        db.session.flush()
        _recompute_tool_borrowed(tool_id)
        db.session.commit()
        return jsonify({"message": "Reservation beendet und gelöscht"}), 200

    # Sonst normal speichern + Tool-Status konsistent
    db.session.flush()
    _recompute_tool_borrowed(res.tool_id)
    db.session.commit()

    return jsonify(
        {
            "id": res.id,
            "start_time": res.start_time.replace(tzinfo=pytz.utc).isoformat(),
            "end_time": res.end_time.replace(tzinfo=pytz.utc).isoformat(),
            "note": getattr(res, "note", None),
        }
    ), 200

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
# - aktive Reservation wird GELÖSCHT (nicht nur gekürzt)
# -----------------------------
@reservation_bp.route("/return-tool", methods=["PATCH", "POST"])
@reservation_bp.route("/return_tool", methods=["PATCH", "POST"])  # Alias
def return_tool():
    """Werkzeug zurückgeben – immer möglich (je nach Berechtigung), unabhängig vom Reservierungszeitpunkt."""
    try:
        payload = get_token_payload()
        user_id = payload["user_id"] if payload else None
    except Exception:
        user_id = None

    # JSON oder Form akzeptieren
    data = request.get_json(silent=True) or request.form or {}
    tool_code = data.get("tool")
    if not tool_code:
        return jsonify({"error": "Missing tool code"}), 400

    tool = Tool.query.filter_by(qr_code=tool_code).first()
    if not tool:
        return jsonify({"error": "Tool not found"}), 404

    # nicht nur "aktive jetzt", sondern "letzte bekannte Reservation"
    last_res = (
        Reservation.query.filter_by(tool_id=tool.id)
        .order_by(Reservation.start_time.desc())
        .first()
    )

    # Berechtigungen:
    # - Gäste dürfen (wie zuvor)
    # - Eingeloggte:
    #     edit_reservations == false  -> 403
    #     edit_reservations == self_only -> nur wenn letzte Res dem User gehört
    if user_id:
        val = _role_value_for(user_id, "edit_reservations")
        if val == "false":
            return jsonify({"error": "Keine Berechtigung"}), 403
        if val == "self_only" and last_res and last_res.user_id != user_id:
            return jsonify({"error": "Keine Berechtigung für fremde Reservationen"}), 403

    # Aktion:
    # - Falls es eine (letzte) Reservation gibt: löschen (damit verschwindet sie im Kalender)
    # - Tool-Status konsistent neu berechnen (falls es noch andere aktive Reservierungen gibt, bleibt borrowed=True)
    if last_res:
        tool_id = last_res.tool_id
        db.session.delete(last_res)
        db.session.flush()
        _recompute_tool_borrowed(tool_id)
        db.session.commit()
        return jsonify({"message": "Werkzeug zurückgegeben (Reservation entfernt)"}), 200

    # Keine Reservation mehr vorhanden (z. B. bereits auto-gelöscht) -> idempotent:
    # Stelle sicher, dass das Tool als verfügbar markiert ist.
    db.session.flush()
    _recompute_tool_borrowed(tool.id)
    db.session.commit()
    return jsonify({"message": "Werkzeug war bereits verfügbar / keine Reservation vorhanden"}), 200
