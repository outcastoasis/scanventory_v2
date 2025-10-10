# backend/routes/reservations.py
from flask import Blueprint, request, jsonify
from models import db, User, Tool, Reservation, RolePermission, Permission
from datetime import datetime, timedelta
from pytz import timezone
import pytz
from utils.permissions import get_token_payload

reservation_bp = Blueprint("reservations", __name__)

def _role_value_for(user_id, perm_key):
    """Gibt 'true' | 'self_only' | 'false' (oder None) für eine Permission zurück."""
    if not user_id:
        return "false"
    perm = Permission.query.filter_by(key=perm_key).first()
    user = User.query.get(user_id)
    if not perm or not user:
        return "false"
    rp = RolePermission.query.filter_by(role_id=user.role_id, permission_id=perm.id).first()
    return rp.value if rp else "false"

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

    # Prüfe Token
    payload = get_token_payload()
    user_id = payload["user_id"] if payload else None
    role = payload["role"] if payload else "guest"

    if user_id:
        # Muss create_reservations >= true haben
        val = _role_value_for(user_id, "create_reservations")
        if val == "false":
            return jsonify({"error": "Keine Berechtigung für Reservation"}), 403
    else:
        # Kein Token → QR-Scan-Modus, aber nur wenn usr...
        if not str(user_code).startswith("usr"):
            return jsonify({"error": "Nur QR-Scan erlaubt ohne Login"}), 401

    # Nutzer/Werkzeug
    user = User.query.filter_by(qr_code=user_code).first()
    if not user:
        user = User(qr_code=user_code, username=user_code)
        db.session.add(user)

    tool = Tool.query.filter_by(qr_code=tool_code).first()
    if not tool:
        tool = Tool(qr_code=tool_code, name=tool_code)
        db.session.add(tool)
        db.session.flush()

    # Zeitkonflikt prüfen
    now_utc = datetime.utcnow()
    conflict = Reservation.query.filter(
        Reservation.tool_id == tool.id,
        Reservation.end_time >= now_utc,  # aktiv oder geplant
    ).first()
    if conflict:
        return jsonify({"error": "Werkzeug ist aktuell oder bald reserviert"}), 400

    # Zeitraum (lokal → UTC)
    zurich = timezone("Europe/Zurich")
    now_local = datetime.now(zurich)
    end_local = now_local.replace(hour=23, minute=59, second=0, microsecond=0) + timedelta(days=duration - 1)

    start_time = now_local.astimezone(pytz.utc)
    end_time = end_local.astimezone(pytz.utc)

    reservation = Reservation(user=user, tool=tool, start_time=start_time, end_time=end_time)
    db.session.add(reservation)
    tool.is_borrowed = True
    db.session.commit()

    return jsonify({"message": "Reservation saved"}), 201


# -----------------------------
# Reservationen abfragen (alle sehen alles)
# -----------------------------
@reservation_bp.route("", methods=["GET"])
def get_reservations():
    to_zone = timezone("Europe/Zurich")

    try:
        payload = get_token_payload()
        user_id = payload["user_id"] if payload else None
        role = payload["role"] if payload else "guest"
    except:
        user_id = None
        role = "guest"

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
    return jsonify(result), 200


# -----------------------------
# Reservation bearbeiten (PATCH)
# -----------------------------
@reservation_bp.route("/<int:res_id>", methods=["PATCH"])
def update_reservation(res_id):
    data = request.get_json() or {}
    payload = get_token_payload()
    user_id = payload["user_id"] if payload else None
    role = payload["role"] if payload else "guest"

    res = Reservation.query.get_or_404(res_id)

    # Rechte prüfen: edit_reservations: true | self_only | false
    val = _role_value_for(user_id, "edit_reservations")
    if val == "false" or not user_id:
        return jsonify({"error": "Keine Berechtigung"}), 403
    if val == "self_only" and res.user_id != user_id:
        return jsonify({"error": "Nur eigene Reservationen bearbeitbar"}), 403

    changed = False

    # start_time / end_time kommen als ISO-UTC (vom Frontend) oder lokale Strings
    if "start_time" in data and data["start_time"]:
        try:
            new_start = _parse_to_utc(data["start_time"])
            if new_start and res.start_time != new_start:
                res.start_time = new_start
                changed = True
        except:
            return jsonify({"error": "Invalid start_time"}), 400

    if "end_time" in data and data["end_time"]:
        try:
            new_end = _parse_to_utc(data["end_time"])
            if new_end and res.end_time != new_end:
                res.end_time = new_end
                changed = True
        except:
            return jsonify({"error": "Invalid end_time"}), 400

    if "note" in data:
        if getattr(res, "note", None) != data["note"]:
            setattr(res, "note", data["note"])
            changed = True

    if not changed:
        return jsonify({"message": "Keine Änderungen"}), 200

    db.session.commit()

    return jsonify({
        "id": res.id,
        "start_time": res.start_time.replace(tzinfo=pytz.utc).isoformat(),
        "end_time": res.end_time.replace(tzinfo=pytz.utc).isoformat(),
        "note": getattr(res, "note", None),
    }), 200


def _parse_to_utc(val):
    """Akzeptiert ISO (mit/ohne Z) oder 'YYYY-mm-dd HH:MM' (lokal) und liefert UTC-datetime."""
    zurich = timezone("Europe/Zurich")
    try:
        # ISO?
        dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            # als lokal interpretieren
            dt = zurich.localize(dt)
        return dt.astimezone(pytz.utc).replace(tzinfo=None)
    except:
        # Fallback: "YYYY-mm-dd HH:MM"
        try:
            dt = datetime.strptime(val, "%Y-%m-%d %H:%M")
            dt = zurich.localize(dt)
            return dt.astimezone(pytz.utc).replace(tzinfo=None)
        except:
            raise


# -----------------------------
# Werkzeug zurückgeben (robust)
# -----------------------------
@reservation_bp.route("/return-tool", methods=["PATCH", "POST"])
@reservation_bp.route("/return_tool", methods=["PATCH", "POST"])  # Alias
def return_tool():
    """Werkzeug zurückgeben – erlaubt für alle, auch ohne Login (Gäste)."""
    try:
        payload = get_token_payload()
        user_id = payload["user_id"] if payload else None
        role = payload["role"] if payload else "guest"
    except:
        user_id = None
        role = "guest"

    # JSON oder Form akzeptieren
    data = request.get_json(silent=True) or request.form or {}
    tool_code = data.get("tool")
    if not tool_code:
        return jsonify({"error": "Missing tool code"}), 400

    tool = Tool.query.filter_by(qr_code=tool_code).first()
    if not tool:
        return jsonify({"error": "Tool not found"}), 404

    reservation = (
        Reservation.query.filter_by(tool_id=tool.id)
        .order_by(Reservation.start_time.desc())
        .first()
    )
    if not reservation or reservation.end_time < datetime.utcnow():
        return jsonify({"error": "Keine aktive Ausleihe gefunden"}), 404

    # Bei eingeloggten Benutzern mit self_only nur eigene Reservation zurückgeben
    if user_id:
        val = _role_value_for(user_id, "edit_reservations")
        if val == "self_only" and reservation.user_id != user_id:
            return jsonify({"error": "Keine Berechtigung für fremde Reservationen"}), 403

    # Rückgabe
    reservation.end_time = datetime.utcnow()
    tool.is_borrowed = False
    db.session.commit()

    return jsonify({"message": "Werkzeug zurückgegeben"}), 200
