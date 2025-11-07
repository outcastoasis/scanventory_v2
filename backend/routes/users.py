# backend/routes/users.py
from flask import Blueprint, request, jsonify, make_response
from models import db, User, Role, Company, Reservation
from utils.permissions import (
    requires_permission,
    get_token_payload,
    requires_any_permission,
)
from werkzeug.security import generate_password_hash
import csv
from io import StringIO, BytesIO

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

    active_reservations = Reservation.query.filter_by(user_id=user_id).count()
    if active_reservations > 0:
        return (
            jsonify(
                {
                    "error": "Benutzer kann nicht gelöscht werden, da noch Reservationen vorhanden sind. Warte mindestens 90 Tage seit der letzten Reservation, bevor du den Benutzer löschst."
                }
            ),
            400,
        )

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
@requires_any_permission("access_admin_panel", "manage_users")
def list_companies():
    companies = Company.query.order_by(Company.name.asc()).all()
    return jsonify([c.serialize() for c in companies])


@users_bp.route("/api/companies", methods=["POST"])
@requires_any_permission("access_admin_panel", "manage_users")
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
@requires_any_permission("access_admin_panel", "manage_users")
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
@requires_any_permission("access_admin_panel", "manage_users")
def delete_company(comp_id):
    company = Company.query.get_or_404(comp_id)

    # 🔄 Neue Prüfung über FK (nicht mehr Name!)
    if User.query.filter_by(company_id=comp_id).first():
        return jsonify({"error": "Firma wird noch verwendet."}), 400

    db.session.delete(company)
    db.session.commit()
    return jsonify({"message": "Firma gelöscht."})


@users_bp.route("/api/users/template", methods=["GET"])
@requires_permission("manage_users")
def export_user_csv_template():
    companies = Company.query.order_by(Company.name.asc()).all()
    roles = Role.query.order_by(Role.name.asc()).all()

    company_names = [c.name for c in companies]
    role_names = [r.name for r in roles]

    output = StringIO()
    writer = csv.writer(output, delimiter=";")

    # Kommentarzeilen (Hinweis)
    writer.writerow([f"# Firmen: {', '.join(company_names)}"])
    writer.writerow([f"# Rollen: {', '.join(role_names)}"])

    # Headerzeile
    writer.writerow(
        ["Benutzername", "Vorname", "Nachname", "Firma", "Rolle", "Passwort"]
    )

    # Optional: Beispielzeile
    # writer.writerow(["jschmidt", "Julia", "Schmidt", "ACME AG", "user", "pass123"])

    csv_text = output.getvalue()
    output.close()

    # UTF-8 BOM hinzufügen
    bom_prefix = b"\xef\xbb\xbf"
    csv_bytes = bom_prefix + csv_text.encode("utf-8")

    response = make_response(csv_bytes)
    response.headers["Content-Disposition"] = (
        "attachment; filename=benutzer_vorlage.csv"
    )
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    return response


@users_bp.route("/api/users/import", methods=["POST"])
@requires_permission("manage_users")
def import_users_csv():
    if "file" not in request.files:
        return jsonify({"error": "Keine Datei hochgeladen"}), 400

    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Bitte eine .csv-Datei hochladen"}), 400

    stream = file.stream.read().decode("utf-8-sig")
    lines = stream.splitlines()
    reader = csv.reader(lines, delimiter=";")

    header_found = False
    imported_count = 0
    skipped = []
    errors = []

    # Bestehende Daten aus DB
    existing_usernames = {u.username.lower() for u in User.query.all()}
    companies = {c.name: c.id for c in Company.query.all()}
    roles = {r.name: r.id for r in Role.query.all()}

    # QR‑Code Nummern vorbereiten
    used_qrs = {
        int(u.qr_code.replace("usr", ""))
        for u in User.query.all()
        if u.qr_code.startswith("usr") and u.qr_code.replace("usr", "").isdigit()
    }
    next_qr_num = 1

    def next_qr():
        nonlocal next_qr_num
        while next_qr_num in used_qrs:
            next_qr_num += 1
        used_qrs.add(next_qr_num)
        return f"usr{next_qr_num:04d}"

    for idx, row in enumerate(reader):
        line_num = idx + 1
        if not row or row[0].startswith("#"):
            continue

        # Header überspringen
        if not header_found:
            expected_header = [
                "benutzername",
                "vorname",
                "nachname",
                "firma",
                "rolle",
                "passwort",
            ]
            normalized = [c.strip().lower() for c in row]
            if normalized != expected_header:
                return (
                    jsonify(
                        {
                            "error": "Ungültige CSV-Struktur. Erwartet: Benutzername;Vorname;Nachname;Firma;Rolle;Passwort"
                        }
                    ),
                    400,
                )
            header_found = True
            continue

        if len(row) < 6:
            errors.append({"row": line_num, "reason": "Zu wenige Spalten"})
            continue

        username, first_name, last_name, company_name, role_name, password = [
            c.strip() for c in row
        ]

        # Pflichtfelder prüfen
        if not username or not password:
            errors.append(
                {"row": line_num, "reason": "Benutzername oder Passwort fehlt"}
            )
            continue

        # Duplikate prüfen
        if username.lower() in existing_usernames:
            skipped.append(
                {"row": line_num, "reason": "Benutzername bereits vorhanden"}
            )
            continue

        # Firma prüfen
        company_id = None
        if company_name:
            company_id = companies.get(company_name)
            if not company_id:
                errors.append(
                    {"row": line_num, "reason": f"Ungültige Firma: '{company_name}'"}
                )
                continue

        # Rolle prüfen
        role_id = roles.get(role_name)
        if not role_id:
            errors.append(
                {"row": line_num, "reason": f"Ungültige Rolle: '{role_name}'"}
            )
            continue

        # Benutzer anlegen
        new_user = User(
            username=username,
            first_name=first_name or None,
            last_name=last_name or None,
            company_id=company_id,
            password=generate_password_hash(password),
            qr_code=next_qr(),
            role_id=role_id,
        )

        db.session.add(new_user)
        existing_usernames.add(username.lower())
        imported_count += 1

    db.session.commit()

    return (
        jsonify(
            {"imported_count": imported_count, "skipped": skipped, "errors": errors}
        ),
        200,
    )
