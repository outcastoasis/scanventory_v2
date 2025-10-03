# backend/routes/permissions.py
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from models import db, Role, Permission, RolePermission
from utils.permissions import requires_permission

permissions_bp = Blueprint("permissions", __name__)

# -------- Permissions: Keys anlegen / listen / löschen --------

@permissions_bp.route("/api/permissions", methods=["GET"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@requires_permission("access_admin_panel")  # nur Admin lt. Matrix
def list_permissions():
    perms = Permission.query.order_by(Permission.key.asc()).all()
    return jsonify([{"id": p.id, "key": p.key} for p in perms])

@permissions_bp.route("/api/permissions", methods=["POST"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@requires_permission("access_admin_panel")
def create_permission():
    data = request.get_json() or {}
    key = (data.get("key") or "").strip()
    if not key:
        return jsonify({"error": "key required"}), 400
    if Permission.query.filter_by(key=key).first():
        return jsonify({"error": "Permission existiert bereits"}), 409

    perm = Permission(key=key)
    db.session.add(perm)
    db.session.commit()
    return jsonify({"id": perm.id, "key": perm.key}), 201

@permissions_bp.route("/api/permissions/<int:perm_id>", methods=["DELETE"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@requires_permission("access_admin_panel")
def delete_permission(perm_id):
    perm = Permission.query.get(perm_id)
    if not perm:
        return jsonify({"error": "Permission nicht gefunden"}), 404

    # Mapping-Einträge mit löschen
    RolePermission.query.filter_by(permission_id=perm.id).delete()
    db.session.delete(perm)
    db.session.commit()
    return jsonify({"message": "Permission gelöscht"}), 200

# -------- Role ↔ Permission Matrix lesen / setzen --------

@permissions_bp.route("/api/role-permissions", methods=["GET"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@requires_permission("access_admin_panel")
def get_role_permissions():
    roles = Role.query.order_by(Role.name.asc()).all()
    perms = Permission.query.order_by(Permission.key.asc()).all()
    matrix = []
    for r in roles:
        row = {"role": r.name, "permissions": {}}
        for p in perms:
            rp = RolePermission.query.filter_by(role_id=r.id, permission_id=p.id).first()
            row["permissions"][p.key] = rp.value if rp else "false"
        matrix.append(row)
    return jsonify(matrix)

@permissions_bp.route("/api/role-permissions", methods=["POST"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@requires_permission("access_admin_panel")
def set_role_permission():
    """
    Body: { "role": "user", "permission": "create_reservations", "value": "true|false|self_only" }
    """
    data = request.get_json() or {}
    role_name = data.get("role")
    perm_key = data.get("permission")
    value = data.get("value")

    if value not in {"true", "false", "self_only"}:
        return jsonify({"error": "Ungültiger value"}), 400

    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return jsonify({"error": "Rolle nicht gefunden"}), 404

    perm = Permission.query.filter_by(key=perm_key).first()
    if not perm:
        return jsonify({"error": "Permission nicht gefunden"}), 404

    rp = RolePermission.query.filter_by(role_id=role.id, permission_id=perm.id).first()
    if rp:
        rp.value = value
    else:
        rp = RolePermission(role_id=role.id, permission_id=perm.id, value=value)
        db.session.add(rp)

    db.session.commit()
    return jsonify({"message": "Gespeichert"}), 200
