# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from models import db, User, RolePermission, Permission
from werkzeug.security import check_password_hash
import jwt
import datetime
import os
from dotenv import load_dotenv
from utils.permissions import get_token_payload


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

    role = user.role.name

    token = jwt.encode(
        {
            "user_id": user.id,
            "username": user.username,
            "role": role,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12),
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

    user = User.query.get(payload["user_id"])
    if not user:
        return jsonify({"error": "Benutzer nicht gefunden"}), 404

    permissions = RolePermission.query.filter_by(role_id=user.role_id).all()
    permission_map = {p.permission.key: p.value for p in permissions if p.permission}

    return jsonify(
        {
            "username": user.username,
            "role": user.role.name,
            "permissions": permission_map,
        }
    )
