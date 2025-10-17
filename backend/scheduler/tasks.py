from datetime import datetime
from models import db, Tool, Reservation
from sqlalchemy import and_
from routes.reservations import _recompute_tool_borrowed


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


def reset_borrowed_tools_fast():
    """Prüft nur Werkzeuge mit aktiver Reservation und setzt deren borrowed-Status."""
    now = datetime.utcnow()
    active_reservations = Reservation.query.filter(
        Reservation.start_time <= now,
        Reservation.end_time >= now,
    ).all()

    affected_tool_ids = set(r.tool_id for r in active_reservations)
    for tid in affected_tool_ids:
        _recompute_tool_borrowed(tid)

    db.session.commit()
