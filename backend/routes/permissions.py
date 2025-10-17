# backend/routes/permissions.py
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from models import db, Role, Permission, RolePermission, User
from utils.permissions import requires_permission, get_token_payload

permissions_bp = Blueprint("permissions", __name__)


# -------- Permissions: Keys anlegen / listen / löschen --------


@permissions_bp.route("/api/permissions", methods=["GET"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@requires_permission("access_admin_panel")
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

    # zugehörige Mappings löschen
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
            rp = RolePermission.query.filter_by(
                role_id=r.id, permission_id=p.id
            ).first()
            row["permissions"][p.key] = rp.value if rp else "false"
        matrix.append(row)
    return jsonify(matrix)


@permissions_bp.route("/api/role-permissions", methods=["POST"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@requires_permission("access_admin_panel")
def set_role_permission():
    """
    Einzelne Änderung:
    { "role": "user", "permission": "create_reservations", "value": "true|false|self_only" }
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
        db.session.add(
            RolePermission(role_id=role.id, permission_id=perm.id, value=value)
        )

    db.session.commit()
    return jsonify({"message": "Gespeichert"}), 200


@permissions_bp.route("/api/role-permissions", methods=["PATCH", "OPTIONS"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@requires_permission("access_admin_panel")
def patch_role_permissions():
    """
    Akzeptiert:
      1) Einzel-Objekt:
         { "role":"user", "permission":"create_reservations", "value":"true" }
      2) Batch-Objekt:
         { "changes":[ {...}, {...} ] }
      3) Reine Liste:
         [ {...}, {...} ]
    """
    data = request.get_json(silent=True) or {}

    # Einzel-Objekt?
    if isinstance(data, dict) and {"role", "permission", "value"} <= set(data.keys()):
        changes = [data]
    else:
        # Batch-Varianten
        changes = data.get("changes")
        if changes is None and isinstance(data, list):
            changes = data

    if not changes:
        return jsonify({"error": "No changes provided"}), 400

    allowed = {"true", "false", "self_only"}

    # Cache für schnellere Zuordnung
    roles_by_name = {r.name: r for r in Role.query.all()}
    perms_by_key = {p.key: p for p in Permission.query.all()}

    updated = 0
    for ch in changes:
        role_name = ch.get("role")
        perm_key = ch.get("permission")
        value = ch.get("value")

        if not role_name or not perm_key or value not in allowed:
            continue

        role = roles_by_name.get(role_name)
        perm = perms_by_key.get(perm_key)
        if not role or not perm:
            continue

        rp = RolePermission.query.filter_by(
            role_id=role.id, permission_id=perm.id
        ).first()
        if rp:
            if rp.value != value:
                rp.value = value
                updated += 1
        else:
            db.session.add(
                RolePermission(role_id=role.id, permission_id=perm.id, value=value)
            )
            updated += 1

    db.session.commit()
    return jsonify({"updated": updated}), 200


@permissions_bp.route("/api/permissions/<int:perm_id>", methods=["PATCH"])
def permission_patch_blocked(perm_id):
    return jsonify({"error": "Bearbeiten von Permission-Keys ist nicht erlaubt."}), 405


@permissions_bp.route("/api/role-permissions/current", methods=["GET"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
def get_current_user_permissions():
    """
    Gibt alle Berechtigungen (Keys + Werte) für den aktuell eingeloggten Benutzer zurück.
    Beispiel: { "create_reservations": "self_only", "edit_reservations": "true", ... }
    """
    payload = get_token_payload()
    user_id = payload.get("user_id") if payload else None
    if not user_id:
        return jsonify({"error": "Not authenticated"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Alle RolePermissions der Benutzerrolle holen
    rps = RolePermission.query.filter_by(role_id=user.role_id).all()
    result = {Permission.query.get(rp.permission_id).key: rp.value for rp in rps}

    return jsonify(result), 200
