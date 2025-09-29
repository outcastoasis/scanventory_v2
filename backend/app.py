# backend/app.py
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from models import db
from routes.reservations import reservation_bp
import os

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(basedir, 'instance', 'database.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})


app.register_blueprint(reservation_bp, url_prefix='/api/reservations')

@app.route('/api/ping')
def ping():
    return {'message': 'pong'}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # DB und Tabellen erstellen
    app.run(debug=True, port=5050)
