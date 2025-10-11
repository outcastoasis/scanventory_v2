from flask import Flask
from flask_cors import CORS
from models import db
from routes.reservations import reservation_bp
from routes.auth import auth_bp
from routes.users import users_bp
from routes.tools import tools_bp
from routes.permissions import permissions_bp
from setup import create_initial_data
import os

# APScheduler importieren
from flask_apscheduler import APScheduler
from scheduler.tasks import reset_expired_borrowed_tools


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
CORS(
    app,
    supports_credentials=True,
    resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
)

# Blueprints registrieren
app.register_blueprint(reservation_bp, url_prefix="/api/reservations")
app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(users_bp)        # enthält schon /api/... in den Routen
app.register_blueprint(tools_bp)        # enthält schon /api/... in den Routen
app.register_blueprint(permissions_bp)  # enthält schon /api/... in den Routen

@app.route("/api/ping")
def ping():
    return {"message": "pong"}

# --- Scheduler starten (mit App-Kontext) ---
scheduler = APScheduler()
scheduler.init_app(app)
scheduler.start()

def _job_reset_expired_borrowed_tools():
    """Wrapper, damit der Job im App-Kontext läuft (SQLAlchemy braucht Kontext)."""
    with app.app_context():
        reset_expired_borrowed_tools()

# Job hinzufügen: alle 10 Minuten prüfen, ob Werkzeuge automatisch zurückgesetzt werden müssen
scheduler.add_job(
    id="auto_reset_is_borrowed",
    func=_job_reset_expired_borrowed_tools,
    trigger="interval",
    minutes=10,
)

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        create_initial_data(app)
    app.run(debug=True, port=5050)
