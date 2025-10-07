from datetime import datetime
from models import db, Tool, Reservation
from sqlalchemy import and_


def reset_expired_borrowed_tools():
    now = datetime.utcnow()

    tools = Tool.query.filter_by(is_borrowed=True).all()

    for tool in tools:
        # Gibt es noch eine aktive Reservation?
        active = Reservation.query.filter(
            Reservation.tool_id == tool.id,
            Reservation.start_time <= now,
            Reservation.end_time >= now,
        ).first()

        if not active:
            tool.is_borrowed = False
            print(f"[Scheduler] Werkzeug {tool.qr_code} als zurückgegeben markiert")

    db.session.commit()
