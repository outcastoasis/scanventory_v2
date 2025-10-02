# backend/app.py
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from models import db
from routes.reservations import reservation_bp
from routes.auth import auth_bp
from routes.users import users_bp
import os
from setup import create_initial_data

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"sqlite:///{os.path.join(basedir, 'instance', 'database.db')}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
CORS(
    app,
    supports_credentials=True,
    resources={r"/api/*": {"origins": "http://localhost:5173"}},
)

# Blueprints registrieren
app.register_blueprint(reservation_bp, url_prefix="/api/reservations")
app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(users_bp)


@app.route("/api/ping")
def ping():
    return {"message": "pong"}


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        create_initial_data(app)
    app.run(debug=True, port=5050)
