# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, User
from routes.reservations import reservation_bp
from routes.auth import auth_bp
from routes.users import users_bp
from routes.tools import tools_bp
from routes.permissions import permissions_bp
from setup import create_initial_data
from flask_migrate import Migrate
from datetime import datetime, UTC
from utils.permissions import get_token_payload
from routes.logs import logs_bp
import os
from utils.logger import write_log
from werkzeug.exceptions import HTTPException

# APScheduler importieren
from flask_apscheduler import APScheduler
from scheduler.tasks import reset_expired_borrowed_tools, sync_borrowed_status_fast


app = Flask(__name__)

basedir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.join(basedir, "instance")
os.makedirs(instance_dir, exist_ok=True)

app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"sqlite:///{os.path.join(basedir, 'instance', 'database.db')}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False


# Scheduler konfigurieren
class Config:
    SCHEDULER_API_ENABLED = True


app.config.from_object(Config())

# DB & CORS
db.init_app(app)
migrate = Migrate(app, db)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})


# Blueprints registrieren
app.register_blueprint(reservation_bp, url_prefix="/api/reservations")
app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(users_bp)  # enthält schon /api/... in den Routen
app.register_blueprint(tools_bp)  # enthält schon /api/... in den Routen
app.register_blueprint(permissions_bp)  # enthält schon /api/... in den Routen
app.register_blueprint(logs_bp)


@app.route("/api/ping")
def ping():
    return {"message": "pong"}


# -------------------------------------------------------
# Global Error Handlers
# -------------------------------------------------------


@app.errorhandler(HTTPException)
def handle_http_exception(e):
    """Saubere JSON-Responses für HTTP-Fehler."""
    write_log("error", f"{e.code} {e.name}: {e.description}")
    response = {
        "error": e.name,
        "message": e.description,
        "status": e.code,
    }
    return jsonify(response), e.code


@app.errorhandler(Exception)
def handle_unexpected_exception(e):
    """Fängt alle unerwarteten Fehler ab."""
    write_log("error", f"Unhandled exception: {repr(e)}")

    if app.debug:
        # Im Debug-Modus vollständige Fehlermeldungen anzeigen
        raise e

    response = {
        "error": "Internal Server Error",
        "message": "Es ist ein unerwarteter Fehler aufgetreten.",
        "status": 500,
    }
    return jsonify(response), 500


@app.before_request
def update_last_active():
    # Nur für API-Routen
    if not request.path.startswith("/api/"):
        return

    payload = get_token_payload()
    if not payload:
        return

    user = db.session.get(User, payload["user_id"])
    if not user:
        return

    now = datetime.now(UTC)
    # Nur aktualisieren, wenn letzte Aktivität älter als 60 Sekunden ist
    # → schützt DB vor unnötigen Writes bei automatischen Poll-Anfragen
    if user.last_active:
        last = user.last_active.replace(tzinfo=UTC)
    else:
        last = None

    # Nur wenn älter als 60 Sekunden
    if not last or (now - last).total_seconds() > 60:
        user.last_active = now
        db.session.commit()


# --- Scheduler starten (mit App-Kontext) ---
scheduler = APScheduler()
scheduler.init_app(app)
scheduler.start()


def _job_reset_expired_borrowed_tools():
    """Wrapper, damit der Job im App-Kontext läuft (SQLAlchemy braucht Kontext)."""
    with app.app_context():
        try:
            reset_expired_borrowed_tools()
        except Exception as e:
            write_log("error", f"Scheduler error (reset): {repr(e)}")


def _job_sync_borrowed_status():
    with app.app_context():
        try:
            sync_borrowed_status_fast()
        except Exception as e:
            write_log("error", f"Scheduler error (sync): {repr(e)}")


# Job hinzufügen: alle 10 Minuten prüfen, ob Werkzeuge automatisch zurückgesetzt werden müssen
scheduler.add_job(
    id="auto_reset_is_borrowed",
    func=_job_reset_expired_borrowed_tools,
    trigger="interval",
    minutes=10,
)

# Kombinierter Sync-Job alle 30 Sekunden
scheduler.add_job(
    id="sync_borrowed_status",
    func=_job_sync_borrowed_status,
    trigger="interval",
    seconds=30,
)


def create_app():
    with app.app_context():
        try:
            db.create_all()
            create_initial_data(app)
            _job_reset_expired_borrowed_tools()
        except Exception as e:
            write_log("error", f"Startup error: {repr(e)}")
    return app


@app.errorhandler(404)
def handle_not_found(e):
    if request.path.startswith("/api/"):
        write_log("error", f"404 Not Found: {request.path}")
        return jsonify({"error": "Not Found", "path": request.path}), 404
    return e


if __name__ == "__main__":
    create_app().run(debug=True, port=5050)
