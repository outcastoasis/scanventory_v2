# backend/routes/tools.py
from flask import Blueprint, request, jsonify
from models import db, Tool
from utils.permissions import requires_permission

tools_bp = Blueprint("tools", __name__)

# NEU: Öffentliche Tool-Suche/Liste für manuelle Reservation (nur lesen)
@tools_bp.route("/api/tools/public", methods=["GET"])
def list_tools_public():
    q = (request.args.get("query") or "").strip()
    limit = min(int(request.args.get("limit", 100)), 200)

    query = Tool.query
    if q:
        like = f"%{q}%"
        # Name, QR-Code, Kategorie durchsuchen
        query = query.filter(
            db.or_(
                Tool.name.ilike(like),
                Tool.qr_code.ilike(like),
                Tool.category.ilike(like),
            )
        )

    tools = query.order_by(Tool.name.asc()).limit(limit).all()

    return jsonify([
        {
            "id": t.id,
            "name": t.name,
            "qr_code": t.qr_code,
            "category": t.category,
            "status": t.status,
            "is_borrowed": t.is_borrowed,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tools
    ])

# Alle Tools (ADMIN/SUPERVISOR)
@tools_bp.route("/api/tools", methods=["GET"])
@requires_permission("manage_tools")
def list_tools():
    tools = Tool.query.order_by(Tool.id.asc()).all()
    return jsonify([
        {
            "id": t.id,
            "name": t.name,
            "qr_code": t.qr_code,
            "category": t.category,
            "status": t.status,
            "is_borrowed": t.is_borrowed,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tools
    ])

# GET /api/tools/qr/<qr_code> → Werkzeug via QR-Code abrufen (ohne Auth)
@tools_bp.route("/api/tools/qr/<qr_code>", methods=["GET"])
def get_tool_by_qr(qr_code):
    tool = Tool.query.filter(Tool.qr_code.ilike(qr_code)).first()
    if not tool:
        return jsonify({"error": "Werkzeug nicht gefunden"}), 404

    return jsonify({
        "id": tool.id,
        "name": tool.name,
        "qr_code": tool.qr_code,
        "category": getattr(tool, "category", None),
        "status": getattr(tool, "status", None),
        "is_borrowed": getattr(tool, "is_borrowed", False),
        "created_at": tool.created_at.isoformat() if getattr(tool, "created_at", None) else None,
    })

# Neues Tool
@tools_bp.route("/api/tools", methods=["POST"])
@requires_permission("manage_tools")
def create_tool():
    data = request.get_json() or {}
    name = data.get("name")
    qr_code = data.get("qr_code")
    category = data.get("category")

    if not name or not qr_code:
        return jsonify({"error": "Name und QR-Code sind Pflichtfelder."}), 400

    if Tool.query.filter_by(qr_code=qr_code).first():
        return jsonify({"error": "QR-Code existiert bereits."}), 409

    tool = Tool(
        name=name,
        qr_code=qr_code,
        category=category,
        status="available",
        is_borrowed=False,
    )
    db.session.add(tool)
    db.session.commit()

    return jsonify({
        "id": tool.id,
        "name": tool.name,
        "qr_code": tool.qr_code,
        "category": tool.category,
        "status": tool.status,
        "is_borrowed": tool.is_borrowed,
        "created_at": tool.created_at.isoformat() if tool.created_at else None,
    }), 201

# Bearbeiten
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

    if "category" in data:
        tool.category = data["category"]

    # status/is_borrowed via Ausleih-Flow steuern

    db.session.commit()

    return jsonify({
        "id": tool.id,
        "name": tool.name,
        "qr_code": tool.qr_code,
        "category": tool.category,
        "status": tool.status,
        "is_borrowed": tool.is_borrowed,
        "created_at": tool.created_at.isoformat() if tool.created_at else None,
    })

# Löschen (optional: blockieren, wenn ausgeliehen)
@tools_bp.route("/api/tools/<int:tool_id>", methods=["DELETE"])
@requires_permission("manage_tools")
def delete_tool(tool_id):
    tool = Tool.query.get(tool_id)
    if not tool:
        return jsonify({"error": "Werkzeug nicht gefunden"}), 404

    if tool.is_borrowed:
        return jsonify({"error": "Werkzeug ist ausgeliehen und kann nicht gelöscht werden."}), 400

    db.session.delete(tool)
    db.session.commit()
    return jsonify({"message": "Werkzeug gelöscht"}), 200

# Nächste freie tool-ID -> tool0001, tool0002, ...
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
