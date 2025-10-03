# backend/utils/auth_utils.py
import os
import jwt
from flask import request, jsonify
from models import User
from dotenv import load_dotenv

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_key")


def get_current_user():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user = User.query.get(decoded["user_id"])
        return {
            "id": decoded["user_id"],
            "role": decoded["role"],
            "user": user,
        }
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
