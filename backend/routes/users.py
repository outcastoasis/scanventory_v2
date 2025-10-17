# backend/routes/users.py
from flask import Blueprint, request, jsonify
from models import db, User, Role, Company
from utils.permissions import requires_permission, get_token_payload
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
                "first_name": u.first_name,
                "last_name": u.last_name,
                "company_id": u.company_id,
                "company_name": u.company_ref.name if u.company_ref else None,
                "qr_code": u.qr_code,
                "role": u.role.name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    )


# GET /api/users/qr/<qr_code> → Benutzer via QR-Code abrufen (ohne Auth)
@users_bp.route("/api/users/qr/<qr_code>", methods=["GET"])
def get_user_by_qr(qr_code):
    user = User.query.filter(User.qr_code.ilike(qr_code)).first()
    if not user:
        return jsonify({"error": "Benutzer nicht gefunden"}), 404

    return jsonify(
        {
            "qr_code": user.qr_code,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
    )


# POST new user
@users_bp.route("/api/users", methods=["POST"])
@requires_permission("manage_users")
def create_user():
    data = request.json
    username = data.get("username")
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    company_id = data.get("company_id")  # NEU
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

    company = Company.query.get(company_id) if company_id else None

    user = User(
        username=username,
        first_name=first_name,
        last_name=last_name,
        company_id=company.id if company else None,
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
                "first_name": user.first_name,
                "last_name": user.last_name,
                "company_id": user.company_id,
                "company_name": user.company_ref.name if user.company_ref else None,
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
    if "first_name" in data:
        user.first_name = data["first_name"]
    if "last_name" in data:
        user.last_name = data["last_name"]

    if "company_id" in data:
        company = Company.query.get(data["company_id"])
        user.company_id = company.id if company else None

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
            "first_name": user.first_name,
            "last_name": user.last_name,
            "company_id": user.company_id,
            "company_name": user.company_ref.name if user.company_ref else None,
            "qr_code": user.qr_code,
            "role": user.role.name,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    )


# DELETE user (mit Schutz vor Selbstlöschung)
@users_bp.route("/api/users/<int:user_id>", methods=["DELETE"])
@requires_permission("manage_users")
def delete_user(user_id):
    # Token auswerten, um aktuellen Benutzer zu bestimmen
    payload = get_token_payload()
    if not payload:
        return jsonify({"error": "Nicht autorisiert"}), 401

    if user_id == payload["user_id"]:
        return jsonify({"error": "Du kannst dich nicht selbst löschen."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Benutzer nicht gefunden"}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Benutzer gelöscht"}), 200


# GET roles for dropdown
@users_bp.route("/api/roles", methods=["GET"])
@requires_permission("manage_users")
def get_roles():
    roles = Role.query.all()
    return jsonify([{"id": r.id, "name": r.name} for r in roles])


# Nächste freie QR-ID für neue Benutzer
@users_bp.route("/api/users/next-id", methods=["GET"])
@requires_permission("manage_users")
def get_next_user_qr():
    users = User.query.all()
    qr_codes = [u.qr_code for u in users if u.qr_code and u.qr_code.startswith("usr")]

    used_numbers = []
    for qr in qr_codes:
        try:
            number = int(qr.replace("usr", ""))
            used_numbers.append(number)
        except ValueError:
            continue

    next_num = 1
    while next_num in used_numbers:
        next_num += 1

    next_qr = f"usr{next_num:04d}"
    return jsonify({"next_qr": next_qr})


# Company routes
@users_bp.route("/api/companies", methods=["GET"])
@requires_permission("manage_users")
def list_companies():
    companies = Company.query.order_by(Company.name.asc()).all()
    return jsonify([c.serialize() for c in companies])


@users_bp.route("/api/companies", methods=["POST"])
@requires_permission("manage_users")
def create_company():
    data = request.get_json() or {}
    name = data.get("name", "").strip()

    if not name:
        return jsonify({"error": "Name darf nicht leer sein."}), 400

    if Company.query.filter_by(name=name).first():
        return jsonify({"error": "Firma existiert bereits."}), 400

    new_company = Company(name=name)
    db.session.add(new_company)
    db.session.commit()
    return jsonify(new_company.serialize()), 201


@users_bp.route("/api/companies/<int:comp_id>", methods=["PATCH"])
@requires_permission("manage_users")
def update_company(comp_id):
    company = Company.query.get_or_404(comp_id)
    data = request.get_json() or {}
    name = data.get("name", "").strip()

    if not name:
        return jsonify({"error": "Name darf nicht leer sein."}), 400

    company.name = name
    db.session.commit()
    return jsonify(company.serialize())


@users_bp.route("/api/companies/<int:comp_id>", methods=["DELETE"])
@requires_permission("manage_users")
def delete_company(comp_id):
    company = Company.query.get_or_404(comp_id)

    # 🔄 Neue Prüfung über FK (nicht mehr Name!)
    if User.query.filter_by(company_id=comp_id).first():
        return jsonify({"error": "Firma wird noch verwendet."}), 400

    db.session.delete(company)
    db.session.commit()
    return jsonify({"message": "Firma gelöscht."})
