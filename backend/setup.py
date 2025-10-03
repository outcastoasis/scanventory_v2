# backend/setup.py
from models import db, User, Role, Permission, RolePermission
from werkzeug.security import generate_password_hash
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

admin_username = os.getenv("ADMIN_USERNAME")
admin_password = os.getenv("ADMIN_PASSWORD")
admin_qr = os.getenv("ADMIN_QR")

supervisor_username = os.getenv("SUPERVISOR_USERNAME")
supervisor_password = os.getenv("SUPERVISOR_PASSWORD")
supervisor_qr = os.getenv("SUPERVISOR_QR")

testuser_username = os.getenv("TESTUSER_USERNAME")
testuser_password = os.getenv("TESTUSER_PASSWORD")
testuser_qr = os.getenv("TESTUSER_QR")


def create_initial_data(app):
    with app.app_context():
        # Rollen anlegen (falls nicht vorhanden)
        roles = ["admin", "supervisor", "user", "guest"]
        role_objs = {}
        for r in roles:
            role = Role.query.filter_by(name=r).first()
            if not role:
                role = Role(name=r)
                db.session.add(role)
            role_objs[r] = role
        db.session.commit()

        # Rechte anlegen
        permissions = [
            "manage_users",
            "manage_tools",
            "create_reservations",
            "edit_reservations",
            "view_all_reservations",
            "access_admin_panel",
            "export_data",
            "export_qr_codes",
        ]
        permission_objs = {}
        for p in permissions:
            perm = Permission.query.filter_by(key=p).first()
            if not perm:
                perm = Permission(key=p)
                db.session.add(perm)
            permission_objs[p] = perm
        db.session.commit()

        # Rollen → Rechte zuweisen (gemäß Berechtigungskonzept)
        matrix = {
            "admin": {
                "manage_users": "true",
                "manage_tools": "true",
                "create_reservations": "true",
                "edit_reservations": "true",
                "view_all_reservations": "true",
                "access_admin_panel": "true",
                "export_data": "true",
                "export_qr_codes": "true",
            },
            "supervisor": {
                "manage_users": "false",
                "manage_tools": "true",
                "create_reservations": "true",
                "edit_reservations": "self_only",
                "view_all_reservations": "true",
                "access_admin_panel": "false",
                "export_data": "true",
                "export_qr_codes": "true",
            },
            "user": {
                "manage_users": "false",
                "manage_tools": "false",
                "create_reservations": "self_only",
                "edit_reservations": "self_only",
                "view_all_reservations": "true",
                "access_admin_panel": "false",
                "export_data": "true",
                "export_qr_codes": "true",
            },
            "guest": {
                "manage_users": "false",
                "manage_tools": "false",
                "create_reservations": "false",
                "edit_reservations": "false",
                "view_all_reservations": "true",
                "access_admin_panel": "false",
                "export_data": "false",
                "export_qr_codes": "false",
            },
        }

        for role_name, perms in matrix.items():
            role = role_objs[role_name]
            for key, value in perms.items():
                perm = permission_objs[key]
                existing = RolePermission.query.filter_by(
                    role_id=role.id, permission_id=perm.id
                ).first()
                if not existing:
                    rp = RolePermission(
                        role_id=role.id, permission_id=perm.id, value=value
                    )
                    db.session.add(rp)
        db.session.commit()

        # Admin-User anlegen (nur wenn noch keiner vorhanden)
        if not User.query.filter_by(username=admin_username).first():
            admin_user = User(
                username=admin_username,
                first_name="Admin",
                last_name="Admin",
                company_name="Administration",
                password=generate_password_hash(admin_password),
                qr_code=admin_qr,
                role_id=role_objs["admin"].id,
                created_at=datetime.utcnow(),
            )
            db.session.add(admin_user)
            db.session.commit()
            print(f"Admin-Benutzer '{admin_username}' wurde erstellt.")
        else:
            print("Admin-Benutzer existiert bereits.")

        # Supervisor-User anlegen (nur wenn noch keiner vorhanden)
        if not User.query.filter_by(username=supervisor_username).first():
            supervisor_user = User(
                username=supervisor_username,
                first_name="Supervisor",
                last_name="Supervisor",
                company_name="Administration",
                password=generate_password_hash(supervisor_password),
                qr_code=supervisor_qr,
                role_id=role_objs["supervisor"].id,
                created_at=datetime.utcnow(),
            )
            db.session.add(supervisor_user)
            db.session.commit()
            print(f"Supervisor-Benutzer '{supervisor_username}' wurde erstellt.")
        else:
            print("Supervisor-Benutzer existiert bereits.")

        # Testuser anlegen (nur wenn noch keiner vorhanden)
        if not User.query.filter_by(username=testuser_username).first():
            test_user = User(
                username=testuser_username,
                first_name="Test",
                last_name="User",
                company_name="Administration",
                password=generate_password_hash(testuser_password),
                qr_code=testuser_qr,
                role_id=role_objs["user"].id,
                created_at=datetime.utcnow(),
            )
            db.session.add(test_user)
            db.session.commit()
            print(f"Test-Benutzer '{testuser_username}' wurde erstellt.")
        else:
            print("Test-Benutzer existiert bereits.")
