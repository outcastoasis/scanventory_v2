# backend/routes/tools.py
from flask import Blueprint, request, jsonify
from models import (
    db,
    Tool,
    Reservation,
    User,
    RolePermission,
    Permission,
)
from utils.permissions import requires_permission, get_token_payload
from datetime import datetime
from pytz import timezone
import pytz

tools_bp = Blueprint("tools", __name__)


# === Öffentliche Tool-Suche/Liste für manuelle Reservation (nur lesen) ===
@tools_bp.route("/api/tools/public", methods=["GET"])
def list_tools_public():
    q = (request.args.get("query") or "").strip()
    limit = min(int(request.args.get("limit", 100)), 200)

    query = Tool.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            db.or_(
                Tool.name.ilike(like),
                Tool.qr_code.ilike(like),
            )
        )

    tools = query.order_by(Tool.name.asc()).limit(limit).all()

    return jsonify(
        [
            {
                "id": t.id,
                "name": t.name,
                "qr_code": t.qr_code,
                "category_id": t.category_id,
                "category_name": t.category_ref.name if t.category_ref else None,
                "status": t.status,
                "is_borrowed": t.is_borrowed,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tools
        ]
    )


# === Verfügbare Werkzeuge im Zeitraum (für manuelle Reservation) ===
@tools_bp.route("/api/tools/available", methods=["GET"])
def get_available_tools():
    """
    Gibt alle Werkzeuge zurück, die im angegebenen Zeitraum (start, end)
    vollständig verfügbar sind.
    Zugriff: user, supervisor, admin (gemäss create_reservations Permission)
    """

    try:
        payload = get_token_payload()
        user_id = payload["user_id"] if payload else None
    except Exception:
        user_id = None

    if not user_id:
        return jsonify({"error": "Authentifizierung erforderlich"}), 401

    # Berechtigungsprüfung (create_reservations)
    perm = Permission.query.filter_by(key="create_reservations").first()
    user = User.query.get(user_id)
    if not perm or not user:
        return jsonify({"error": "Keine Berechtigung"}), 403

    rp = RolePermission.query.filter_by(
        role_id=user.role_id, permission_id=perm.id
    ).first()
    if not rp or rp.value == "false":
        return jsonify({"error": "Keine Berechtigung für Reservation"}), 403

    # Start-/Endzeit validieren
    start_str = request.args.get("start")
    end_str = request.args.get("end")
    if not start_str or not end_str:
        return jsonify({"error": "Parameter 'start' und 'end' sind erforderlich"}), 400

    zurich = timezone("Europe/Zurich")
    try:
        start_local = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        end_local = datetime.fromisoformat(end_str.replace("Z", "+00:00"))

        if start_local.tzinfo is None:
            start_local = zurich.localize(start_local)
        if end_local.tzinfo is None:
            end_local = zurich.localize(end_local)

        start_utc = start_local.astimezone(pytz.utc).replace(tzinfo=None)
        end_utc = end_local.astimezone(pytz.utc).replace(tzinfo=None)
    except Exception:
        return jsonify({"error": "Ungültiges Datumsformat"}), 400

    if start_utc >= end_utc:
        return jsonify({"error": "Startzeit muss vor Endzeit liegen"}), 400

    # Tools ohne zeitliche Überschneidung mit bestehenden Reservationen
    subquery = (
        db.session.query(Reservation.tool_id)
        .filter(
            db.and_(
                Reservation.start_time < end_utc,
                Reservation.end_time > start_utc,
            )
        )
        .subquery()
    )

    available_tools = (
        Tool.query.filter(~Tool.id.in_(subquery)).order_by(Tool.name.asc()).all()
    )

    return jsonify(
        [
            {
                "id": t.id,
                "name": t.name,
                "qr_code": t.qr_code,
                "category_id": t.category_id,
                "category_name": t.category_ref.name if t.category_ref else None,
                "status": t.status,
                "is_borrowed": t.is_borrowed,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in available_tools
        ]
    )


# === Alle Tools (ADMIN/SUPERVISOR) ===
@tools_bp.route("/api/tools", methods=["GET"])
@requires_permission("manage_tools")
def list_tools():
    tools = Tool.query.order_by(Tool.id.asc()).all()
    return jsonify(
        [
            {
                "id": t.id,
                "name": t.name,
                "qr_code": t.qr_code,
                "category_id": t.category_id,
                "category_name": t.category_ref.name if t.category_ref else None,
                "status": t.status,
                "is_borrowed": t.is_borrowed,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tools
        ]
    )


# GET /api/tools/qr/<qr_code> → Werkzeug via QR-Code abrufen (ohne Auth)
@tools_bp.route("/api/tools/qr/<qr_code>", methods=["GET"])
def get_tool_by_qr(qr_code):
    tool = Tool.query.filter(Tool.qr_code.ilike(qr_code)).first()
    if not tool:
        return jsonify({"error": "Werkzeug nicht gefunden"}), 404

    return jsonify(
        {
            "id": tool.id,
            "name": tool.name,
            "qr_code": tool.qr_code,
            "category_id": tool.category_id,
            "category_name": tool.category_ref.name if tool.category_ref else None,
            "status": getattr(tool, "status", None),
            "is_borrowed": getattr(tool, "is_borrowed", False),
            "created_at": (
                tool.created_at.isoformat()
                if getattr(tool, "created_at", None)
                else None
            ),
        }
    )


# === Neues Tool ===
@tools_bp.route("/api/tools", methods=["POST"])
@requires_permission("manage_tools")
def create_tool():
    data = request.get_json() or {}
    name = data.get("name")
    qr_code = data.get("qr_code")
    category_id = data.get("category_id")

    if not name or not qr_code:
        return jsonify({"error": "Name und QR-Code sind Pflichtfelder."}), 400

    if Tool.query.filter_by(qr_code=qr_code).first():
        return jsonify({"error": "QR-Code existiert bereits."}), 409

    tool = Tool(
        name=name,
        qr_code=qr_code,
        category_id=category_id,
        status="available",
        is_borrowed=False,
    )
    db.session.add(tool)
    db.session.commit()

    return (
        jsonify(
            {
                "id": tool.id,
                "name": tool.name,
                "qr_code": tool.qr_code,
                "category_id": tool.category_id,
                "category_name": tool.category_ref.name if tool.category_ref else None,
                "status": tool.status,
                "is_borrowed": tool.is_borrowed,
                "created_at": tool.created_at.isoformat() if tool.created_at else None,
            }
        ),
        201,
    )


# === Tool bearbeiten ===
@tools_bp.route("/api/tools/<int:tool_id>", methods=["PATCH"])
@requires_permission("manage_tools")
def update_tool(tool_id):
    tool = Tool.query.get_or_404(tool_id)
    data = request.get_json() or {}

    if "name" in data:
        tool.name = data["name"]

    if "qr_code" in data:
        new_qr = data["qr_code"]
        if new_qr != tool.qr_code and Tool.query.filter_by(qr_code=new_qr).first():
            return jsonify({"error": "QR-Code existiert bereits."}), 409
        tool.qr_code = new_qr

    if "category_id" in data:
        tool.category_id = data["category_id"]

    db.session.commit()

    return jsonify(
        {
            "id": tool.id,
            "name": tool.name,
            "qr_code": tool.qr_code,
            "category_id": tool.category_id,
            "category_name": tool.category_ref.name if tool.category_ref else None,
            "status": tool.status,
            "is_borrowed": tool.is_borrowed,
            "created_at": tool.created_at.isoformat() if tool.created_at else None,
        }
    )


# === Tool löschen ===
@tools_bp.route("/api/tools/<int:tool_id>", methods=["DELETE"])
@requires_permission("manage_tools")
def delete_tool(tool_id):
    tool = Tool.query.get(tool_id)
    if not tool:
        return jsonify({"error": "Werkzeug nicht gefunden"}), 404

    if tool.is_borrowed:
        return (
            jsonify(
                {"error": "Werkzeug ist ausgeliehen und kann nicht gelöscht werden."}
            ),
            400,
        )

    db.session.delete(tool)
    db.session.commit()
    return jsonify({"message": "Werkzeug gelöscht"}), 200


# === Nächste freie tool-ID ===
@tools_bp.route("/api/tools/next-id", methods=["GET"])
@requires_permission("manage_tools")
def next_tool_qr():
    tools = Tool.query.all()
    nums = []
    for t in tools:
        if t.qr_code and t.qr_code.startswith("tool"):
            try:
                nums.append(int(t.qr_code.replace("tool", "")))
            except ValueError:
                pass
    n = 1
    while n in nums:
        n += 1
    return jsonify({"next_qr": f"tool{n:04d}"})


# Werkzeug-Info + nächste Reservationen abrufen (z. B. bei "tool zuerst gescannt")
@tools_bp.route("/api/tools/info/<qr_code>", methods=["GET"])
def get_tool_info(qr_code):
    tool = Tool.query.filter(Tool.qr_code.ilike(qr_code)).first()
    if not tool:
        return jsonify({"error": "Werkzeug nicht gefunden"}), 404

    now_utc = datetime.utcnow()
    zurich = timezone("Europe/Zurich")

    # Aktive Reservation (falls jetzt ausgeliehen)
    active = (
        Reservation.query.filter_by(tool_id=tool.id)
        .filter(Reservation.start_time <= now_utc)
        .filter(Reservation.end_time >= now_utc)
        .order_by(Reservation.start_time.asc())
        .first()
    )

    # Kommende Reservationen (max. 2)
    upcoming = (
        Reservation.query.filter_by(tool_id=tool.id)
        .filter(Reservation.start_time > now_utc)
        .order_by(Reservation.start_time.asc())
        .limit(2)
        .all()
    )

    def res_to_dict(res):
        start_local = res.start_time.replace(tzinfo=pytz.utc).astimezone(zurich)
        end_local = res.end_time.replace(tzinfo=pytz.utc).astimezone(zurich)
        return {
            "user": {
                "first_name": res.user.first_name,
                "last_name": res.user.last_name,
            },
            "start": start_local.strftime("%Y-%m-%d %H:%M"),
            "end": end_local.strftime("%Y-%m-%d %H:%M"),
        }

    return jsonify(
        {
            "tool": {
                "name": tool.name,
                "qr_code": tool.qr_code,
                "is_borrowed": tool.is_borrowed,
            },
            "active_reservation": res_to_dict(active) if active else None,
            "upcoming_reservations": [res_to_dict(r) for r in upcoming],
        }
    )


@tools_bp.route("/api/categories", methods=["GET"])
@requires_permission("manage_tools")
def list_categories():
    from models import ToolCategory

    categories = ToolCategory.query.order_by(ToolCategory.name.asc()).all()
    return jsonify([cat.serialize() for cat in categories])


@tools_bp.route("/api/categories/<int:cat_id>", methods=["PATCH"])
@requires_permission("manage_tools")
def update_category(cat_id):
    from models import ToolCategory

    category = ToolCategory.query.get_or_404(cat_id)
    data = request.get_json() or {}
    name = data.get("name", "").strip()

    if not name:
        return jsonify({"error": "Name darf nicht leer sein."}), 400

    category.name = name
    db.session.commit()

    return jsonify(category.serialize())


@tools_bp.route("/api/categories/<int:cat_id>", methods=["DELETE"])
@requires_permission("manage_tools")
def delete_category(cat_id):
    from models import ToolCategory

    category = ToolCategory.query.get_or_404(cat_id)

    # Prüfen, ob noch Tools mit dieser Kategorie existieren
    tools_with_category = Tool.query.filter_by(category_id=category.id).first()
    if tools_with_category:
        return jsonify({"error": "Kategorie wird noch verwendet."}), 400

    db.session.delete(category)
    db.session.commit()
    return jsonify({"message": "Kategorie gelöscht."}), 200


@tools_bp.route("/api/categories", methods=["POST"])
@requires_permission("manage_tools")
def create_category():
    from models import ToolCategory

    data = request.get_json() or {}
    name = data.get("name", "").strip()

    if not name:
        return jsonify({"error": "Name darf nicht leer sein."}), 400

    # Optional: prüfen, ob der Name schon existiert
    if ToolCategory.query.filter_by(name=name).first():
        return jsonify({"error": "Kategorie existiert bereits."}), 400

    new_category = ToolCategory(name=name)
    db.session.add(new_category)
    db.session.commit()
    return jsonify(new_category.serialize()), 201
