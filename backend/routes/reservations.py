from flask import Blueprint, request, jsonify
from models import db, User, Tool, Reservation, RolePermission, Permission
from datetime import datetime, timedelta
from pytz import timezone
import pytz
from utils.permissions import requires_permission, get_token_payload

reservation_bp = Blueprint("reservations", __name__)


# -----------------------------
# Reservation anlegen
# -----------------------------
@reservation_bp.route("", methods=["POST"])
def create_reservation():
    data = request.get_json()
    user_code = data.get("user")
    tool_code = data.get("tool")
    duration = int(data.get("duration") or 0)

    if not user_code or not tool_code or not duration:
        return jsonify({"error": "Missing fields"}), 400

    # 🧠 Prüfe, ob ein gültiger Token gesendet wurde
    payload = get_token_payload()
    if payload:
        user_id = payload["user_id"]
        role = payload["role"]

        # Prüfe, ob Rolle create_reservations darf
        perm = Permission.query.filter_by(key="create_reservations").first()
        if perm:
            role_permission = RolePermission.query.filter_by(
                role_id=User.query.get(user_id).role_id, permission_id=perm.id
            ).first()

            if not role_permission or role_permission.value == "false":
                return jsonify({"error": "Keine Berechtigung für Reservation"}), 403

    else:
        # 📌 Kein Token vorhanden – QR-Scan-Modus aktiv
        # Wir erlauben das, solange der User ein QR-Code ist
        if not user_code.startswith("usr"):
            return jsonify({"error": "Nur QR-Scan erlaubt ohne Login"}), 401

    # ↓ ab hier normale Verarbeitung
    user = User.query.filter_by(qr_code=user_code).first()
    if not user:
        user = User(qr_code=user_code, username=user_code)
        db.session.add(user)

    tool = Tool.query.filter_by(qr_code=tool_code).first()
    if not tool:
        tool = Tool(qr_code=tool_code, name=tool_code)
        db.session.add(tool)
        db.session.flush()

    if tool.is_borrowed:
        return jsonify({"error": "Werkzeug ist bereits ausgeliehen"}), 400

    zurich = timezone("Europe/Zurich")
    now_local = datetime.now(zurich)
    end_local = now_local.replace(
        hour=23, minute=59, second=0, microsecond=0
    ) + timedelta(days=duration - 1)
    start_time = now_local.astimezone(pytz.utc)
    end_time = end_local.astimezone(pytz.utc)

    reservation = Reservation(
        user=user, tool=tool, start_time=start_time, end_time=end_time
    )
    db.session.add(reservation)
    tool.is_borrowed = True
    db.session.commit()

    return jsonify({"message": "Reservation saved"}), 201


# -----------------------------
# Reservationen abfragen
# -----------------------------
@reservation_bp.route("", methods=["GET"])
def get_reservations():
    from_zone = pytz.utc
    to_zone = timezone("Europe/Zurich")

    try:
        from utils.permissions import get_token_payload

        payload = get_token_payload()
        user_id = payload["user_id"] if payload else None
        role = payload["role"] if payload else "guest"  # ← HIER wichtig!
    except:
        user_id = None
        role = "guest"

    # 📌 Sichtbarkeit: Alle sehen alles
    reservations = Reservation.query.order_by(Reservation.start_time.desc()).all()

    result = []
    for res in reservations:
        start_local = res.start_time.replace(tzinfo=pytz.utc).astimezone(to_zone)
        end_local = res.end_time.replace(tzinfo=pytz.utc).astimezone(to_zone)
        result.append(
            {
                "id": res.id,
                "user": res.user.qr_code,
                "tool": res.tool.qr_code,
                "start": start_local.strftime("%Y-%m-%d %H:%M"),
                "end": end_local.strftime("%Y-%m-%d %H:%M"),
            }
        )

    return jsonify(result)


# -----------------------------
# Werkzeug zurückgeben
# -----------------------------
@reservation_bp.route("/return-tool", methods=["PATCH"])
def return_tool():
    """Werkzeug zurückgeben – erlaubt für alle, auch ohne Login"""
    try:
        from utils.permissions import get_token_payload

        payload = get_token_payload()
        user_id = payload["user_id"] if payload else None
        role = payload["role"] if payload else "guest"
    except:
        user_id = None
        role = "guest"

    data = request.get_json()
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

    # ❗️Bei eingeloggten Benutzern mit self_only: nur eigene Reservation zurückgeben
    if role != "guest":
        from models import RolePermission, Permission, User

        perm = Permission.query.filter_by(key="edit_reservations").first()
        user = User.query.get(user_id)

        if perm and user:
            role_permission = RolePermission.query.filter_by(
                role_id=user.role_id, permission_id=perm.id
            ).first()

            if role_permission and role_permission.value == "self_only":
                if reservation.user_id != user.id:
                    return (
                        jsonify(
                            {"error": "Keine Berechtigung für fremde Reservationen"}
                        ),
                        403,
                    )

    # ✅ Rückgabe durchführen – auch für Gäste
    reservation.end_time = datetime.utcnow()
    tool.is_borrowed = False
    db.session.commit()

    return jsonify({"message": "Werkzeug zurückgegeben"}), 200
