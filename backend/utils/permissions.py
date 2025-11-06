# backend/utils/permissions.py
from functools import wraps
from flask import request, jsonify
import jwt
import os
from dotenv import load_dotenv
from models import db, User, RolePermission, Permission

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_key")


def get_token_payload():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return decoded
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def requires_permission(permission_key):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            payload = get_token_payload()
            if not payload:
                return jsonify({"error": "Nicht autorisiert"}), 401

            user = User.query.get(payload["user_id"])
            if not user:
                return jsonify({"error": "Benutzer nicht gefunden"}), 401

            # Prüfe, ob Recht existiert
            permission = Permission.query.filter_by(key=permission_key).first()
            if not permission:
                return (
                    jsonify(
                        {"error": f"Berechtigung '{permission_key}' nicht definiert"}
                    ),
                    403,
                )

            # Hole Zuweisung Rolle ↔ Berechtigung
            role_permission = RolePermission.query.filter_by(
                role_id=user.role_id, permission_id=permission.id
            ).first()

            if not role_permission:
                return jsonify({"error": "Keine Berechtigung zugewiesen"}), 403

            value = role_permission.value
            if value == "false":
                return jsonify({"error": "Zugriff verweigert"}), 403

            # Bei self_only kannst du im Handler selbst weiter prüfen (z. B. ob Reservation zur eigenen user_id gehört)
            request.user = user  # ← für Zugriff im Handler
            request.permission_value = value  # ← z. B. "true" oder "self_only"

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def requires_any_permission(*required_keys):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            payload = get_token_payload()
            if not payload:
                return jsonify({"error": "Nicht authentifiziert"}), 401

            user = User.query.get(payload["user_id"])
            if not user or not user.role:
                return jsonify({"error": "Zugriff verweigert"}), 403

            user_perms = {
                rp.permission.key
                for rp in user.role.permissions
                if rp.value.lower() == "true"
            }

            if not any(key in user_perms for key in required_keys):
                return jsonify({"error": "Zugriff verweigert"}), 403

            return f(*args, **kwargs)

        return wrapper

    return decorator
