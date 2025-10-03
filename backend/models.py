# backend/models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


# Rollen (admin, user, guest etc.)
class Role(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

    # Beziehungen
    users = db.relationship("User", backref="role", lazy=True)
    permissions = db.relationship("RolePermission", backref="role", lazy=True)


# Rechte (z. B. manage_users, edit_reservations)
class Permission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)  # z. B. "manage_users"

    # Beziehung zu Rollen via Mapping
    roles = db.relationship("RolePermission", backref="permission", lazy=True)


# Zuordnung Rolle ↔ Rechte mit Werten (true, false, self_only)
class RolePermission(db.Model):
    role_id = db.Column(db.Integer, db.ForeignKey("role.id"), primary_key=True)
    permission_id = db.Column(
        db.Integer, db.ForeignKey("permission.id"), primary_key=True
    )
    value = db.Column(
        db.String(20), nullable=False
    )  # z. B. "true", "false", "self_only"


# Benutzer
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)  # Anzeigbarer Name
    first_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=True)
    company_name = db.Column(db.String(100), nullable=True)
    password = db.Column(db.String(255), nullable=False)  # Gehashter Hash
    qr_code = db.Column(db.String(20), unique=True, nullable=False)  # z. B. USR0001
    role_id = db.Column(db.Integer, db.ForeignKey("role.id"), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reservations = db.relationship("Reservation", backref="user", lazy=True)
    logs = db.relationship("Log", backref="user", lazy=True)


# Werkzeuge
class Tool(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    qr_code = db.Column(db.String(20), unique=True, nullable=False)  # z. B. TOOL0001
    status = db.Column(
        db.String(20), default="available"
    )  # available, borrowed, reserved
    is_borrowed = db.Column(db.Boolean, default=False)
    category = db.Column(db.String(50))  # z. B. Elektro
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reservations = db.relationship("Reservation", backref="tool", lazy=True)


# Reservationen
class Reservation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    tool_id = db.Column(db.Integer, db.ForeignKey("tool.id"), nullable=False)

    start_time = db.Column(db.DateTime, nullable=False)  # UTC
    end_time = db.Column(db.DateTime, nullable=False)  # UTC
    confirmed = db.Column(db.Boolean, default=False)  # Bestätigung der Ausleihe
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# Logs (optional)
class Log(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
