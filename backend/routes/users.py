from flask import Blueprint, request, jsonify
from models import db, User, Role
from utils.permissions import requires_permission
from werkzeug.security import generate_password_hash

users_bp = Blueprint("users", __name__)


# GET all users
@users_bp.route("/api/users", methods=["GET"])
@requires_permission("manage_users")
def get_users():
    users = User.query.all()
    return jsonify(
        [
            {
                "id": u.id,
                "username": u.username,
                "qr_code": u.qr_code,
                "role": u.role.name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    )


# POST new user
@users_bp.route("/api/users", methods=["POST"])
@requires_permission("manage_users")
def create_user():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    qr_code = data.get("qr_code")
    role_name = data.get("role")

    if not all([username, password, qr_code, role_name]):
        return jsonify({"error": "Fehlende Felder"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Benutzername existiert bereits"}), 409

    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return jsonify({"error": "Rolle existiert nicht"}), 400

    user = User(
        username=username,
        password=generate_password_hash(password),
        qr_code=qr_code,
        role_id=role.id,
    )
    db.session.add(user)
    db.session.commit()

    return (
        jsonify(
            {
                "id": user.id,
                "username": user.username,
                "qr_code": user.qr_code,
                "role": role.name,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }
        ),
        201,
    )


# PATCH existing user
@users_bp.route("/api/users/<int:user_id>", methods=["PATCH"])
@requires_permission("manage_users")
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json

    if "username" in data:
        user.username = data["username"]

    if "password" in data and data["password"]:
        user.password = generate_password_hash(data["password"])

    if "qr_code" in data:
        user.qr_code = data["qr_code"]

    if "role" in data:
        role = Role.query.filter_by(name=data["role"]).first()
        if role:
            user.role_id = role.id

    db.session.commit()

    return jsonify(
        {
            "id": user.id,
            "username": user.username,
            "qr_code": user.qr_code,
            "role": user.role.name,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    )


# DELETE user
@users_bp.route("/api/users/<int:user_id>", methods=["DELETE"])
@requires_permission("manage_users")
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Benutzer gelöscht"})


# GET roles for dropdown
@users_bp.route("/api/roles", methods=["GET"])
@requires_permission("manage_users")
def get_roles():
    roles = Role.query.all()
    return jsonify([{"id": r.id, "name": r.name} for r in roles])


@users_bp.route("/api/users/next-id", methods=["GET"])
@requires_permission("manage_users")
def get_next_user_qr():
    # Alle QR-Codes, die mit usr beginnen
    users = User.query.all()
    qr_codes = [u.qr_code for u in users if u.qr_code and u.qr_code.startswith("usr")]

    # Extrahiere die Nummern
    used_numbers = []
    for qr in qr_codes:
        try:
            number = int(qr.replace("usr", ""))
            used_numbers.append(number)
        except ValueError:
            continue

    # Finde die erste freie Zahl
    next_num = 1
    while next_num in used_numbers:
        next_num += 1

    next_qr = f"usr{next_num:04d}"
    return jsonify({"next_qr": next_qr})
