from app import app
from models import db
from sqlalchemy import text


def column_exists():
    # SQLAlchemy 2.0 verlangt text(...)
    result = db.session.execute(text("PRAGMA table_info(reservation);")).fetchall()
    cols = [r[1] for r in result]
    return "note" in cols


with app.app_context():
    if column_exists():
        print("Spalte 'note' existiert bereits – nichts zu tun.")
    else:
        db.session.execute(text("ALTER TABLE reservation ADD COLUMN note TEXT;"))
        db.session.commit()
        print("Spalte 'note' wurde erfolgreich hinzugefügt.")
