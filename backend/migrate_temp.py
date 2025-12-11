# migrate_add_last_active.py
from app import app, db
from sqlalchemy import text

with app.app_context():

    result = db.session.execute(text("PRAGMA table_info(user);")).fetchall()
    columns = [r[1] for r in result]

    if "last_active" not in columns:
        print("Adding column last_active ...")
        db.session.execute(text("ALTER TABLE user ADD COLUMN last_active DATETIME;"))
        db.session.commit()
        print("Done.")
    else:
        print("Column last_active already exists.")
