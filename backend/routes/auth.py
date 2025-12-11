# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from models import db, User, RolePermission, Permission
import jwt
import os
from dotenv import load_dotenv
from utils.permissions import get_token_payload
from werkzeug.security import check_password_hash, generate_password_hash
from utils.auth_utils import get_current_user
from datetime import datetime, timedelta

load_dotenv()  # .env-Datei laden

auth_bp = Blueprint("auth", __name__)

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_key")  # Fallback falls env fehlt


@auth_bp.route("/login", methods=["POST", "OPTIONS"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
def login():
    if request.method == "OPTIONS":
        return "", 200  # Preflight OK

    data = request.json
    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Ungültige Anmeldedaten"}), 401

    user.last_login = datetime.utcnow()
    user.last_active = datetime.utcnow()
    db.session.commit()

    role = user.role.name

    token = jwt.encode(
        {
            "user_id": user.id,
            "username": user.username,
            "role": role,
            "exp": datetime.utcnow() + timedelta(days=7),
        },
        os.getenv("SECRET_KEY", "fallback_key"),
        algorithm="HS256",
    )

    return jsonify(
        {
            "token": token,
            "role": role,
            "username": user.username,
        }
    )


@auth_bp.route("/me", methods=["GET"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
def get_me():
    payload = get_token_payload()
    if not payload:
        return jsonify({"error": "Nicht autorisiert"}), 401

    user = db.session.get(User, payload["user_id"])
    if not user:
        return jsonify({"error": "Benutzer nicht gefunden"}), 404

    permissions = RolePermission.query.filter_by(role_id=user.role_id).all()
    permission_map = {p.permission.key: p.value for p in permissions if p.permission}

    return jsonify(
        {
            "username": user.username,
            "role": user.role.name,
            "permissions": permission_map,
            "user_id": user.id,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "last_active": user.last_active.isoformat() if user.last_active else None,
        }
    )


@auth_bp.route("/change-password", methods=["POST"])
def change_password():
    user_info = get_current_user()
    if not user_info:
        return jsonify({"error": "Nicht eingeloggt"}), 401

    data = request.get_json() or {}
    old_pw = data.get("old_password", "")
    new_pw = data.get("new_password", "")

    user = user_info["user"]

    # Altes Passwort prüfen
    if not check_password_hash(user.password, old_pw):
        return jsonify({"error": "Altes Passwort ist falsch"}), 400

    # Passwort-Richtlinien prüfen
    if (
        len(new_pw) < 8
        or not any(c.isdigit() for c in new_pw)
        or not any(c.isupper() for c in new_pw)
    ):
        return (
            jsonify(
                {
                    "error": "Passwort muss mind. 8 Zeichen lang sein, eine Zahl und einen Grossbuchstaben enthalten."
                }
            ),
            400,
        )

    # Neues Passwort setzen
    user.password = generate_password_hash(new_pw)
    db.session.commit()

    return jsonify({"message": "Passwort erfolgreich geändert"}), 200
