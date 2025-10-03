# backend/routes/permissions.py
from flask import Blueprint, request, jsonify
from models import db, Role, Permission, RolePermission
from utils.permissions import requires_permission

permissions_bp = Blueprint("permissions", __name__)

# -------- Permissions CRUD --------

@permissions_bp.route("/permissions", methods=["GET"])
@requires_permission("access_admin_panel")
def list_permissions():
    perms = Permission.query.order_by(Permission.key.asc()).all()
    return jsonify([{"id": p.id, "key": p.key} for p in perms])

@permissions_bp.route("/permissions", methods=["POST"])
@requires_permission("access_admin_panel")
def create_permission():
    data = request.get_json() or {}
    key = (data.get("key") or "").strip()
    if not key:
        return jsonify({"error": "Key darf nicht leer sein"}), 400
    if Permission.query.filter_by(key=key).first():
        return jsonify({"error": "Permission-Key existiert bereits"}), 409

    perm = Permission(key=key)
    db.session.add(perm)
    db.session.commit()
    return jsonify({"id": perm.id, "key": perm.key}), 201

@permissions_bp.route("/permissions/<int:perm_id>", methods=["PATCH"])
@requires_permission("access_admin_panel")
def update_permission(perm_id):
    perm = Permission.query.get_or_404(perm_id)
    data = request.get_json() or {}
    key = (data.get("key") or "").strip()
    if not key:
        return jsonify({"error": "Key darf nicht leer sein"}), 400
    if Permission.query.filter(Permission.id != perm_id, Permission.key == key).first():
        return jsonify({"error": "Permission-Key existiert bereits"}), 409

    old_key = perm.key
    perm.key = key
    db.session.commit()

    # Hinweis: RolePermission bleibt bestehen, verweist ja via FK auf Permission.id
    return jsonify({"id": perm.id, "key": perm.key})

@permissions_bp.route("/permissions/<int:perm_id>", methods=["DELETE"])
@requires_permission("access_admin_panel")
def delete_permission(perm_id):
    perm = Permission.query.get_or_404(perm_id)

    # Alle Mappings entfernen, dann Permission
    RolePermission.query.filter_by(permission_id=perm.id).delete()
    db.session.delete(perm)
    db.session.commit()
    return jsonify({"message": "Permission gelöscht"})

# -------- Role-Permissions Matrix --------

@permissions_bp.route("/role-permissions", methods=["GET"])
@requires_permission("access_admin_panel")
def get_role_permissions():
    """Flache Liste: [{role, permission, value}]"""
    # Hole alle Rollen/Permissions, dann Mappings
    roles = Role.query.all()
    perms = Permission.query.all()
    mappings = RolePermission.query.all()

    result = []
    # Default false für alle Kombinationen?
    # Frontend baut Default already; wir liefern nur existierende Mappings:
    for m in mappings:
        role = next((r for r in roles if r.id == m.role_id), None)
        perm = next((p for p in perms if p.id == m.permission_id), None)
        if role and perm:
            result.append({
                "role": role.name,
                "permission": perm.key,
                "value": m.value
            })
    return jsonify(result)

@permissions_bp.route("/role-permissions", methods=["PATCH"])
@requires_permission("access_admin_panel")
def set_role_permission():
    """Body: {role, permission, value} mit value in {'true','false','self_only'}"""
    data = request.get_json() or {}
    role_name = (data.get("role") or "").strip()
    perm_key = (data.get("permission") or "").strip()
    value = (data.get("value") or "").strip()

    if value not in {"true", "false", "self_only"}:
        return jsonify({"error": "Ungültiger Wert. Erlaubt: true, false, self_only"}), 400

    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return jsonify({"error": "Rolle nicht gefunden"}), 404

    perm = Permission.query.filter_by(key=perm_key).first()
    if not perm:
        return jsonify({"error": "Permission nicht gefunden"}), 404

    mapping = RolePermission.query.filter_by(role_id=role.id, permission_id=perm.id).first()
    if not mapping:
        mapping = RolePermission(role_id=role.id, permission_id=perm.id, value=value)
        db.session.add(mapping)
    else:
        mapping.value = value

    db.session.commit()
    return jsonify({"message": "Gespeichert", "role": role.name, "permission": perm.key, "value": value})
