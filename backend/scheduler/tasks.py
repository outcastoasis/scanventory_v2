from datetime import datetime
from models import db, Tool, Reservation
from sqlalchemy import and_


def reset_expired_borrowed_tools():
    now = datetime.utcnow()
    all_tools = Tool.query.all()
    for tool in all_tools:
        active = Reservation.query.filter(
            Reservation.tool_id == tool.id,
            Reservation.start_time <= now,
            Reservation.end_time >= now,
        ).first()
        tool.is_borrowed = bool(active)
    db.session.commit()
