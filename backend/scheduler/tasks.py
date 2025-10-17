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


def sync_borrowed_status_fast():
    """
    Kombinierter Job:
    - Setzt is_borrowed = True für Tools mit aktiver Reservation
    - Setzt is_borrowed = False für Tools mit abgelaufener Reservation
    Wird z. B. alle 30 Sekunden ausgeführt
    """
    now = datetime.utcnow()

    # 1. Aktive Reservationen → Tools auf borrowed = True setzen
    active_reservations = Reservation.query.filter(
        Reservation.start_time <= now,
        Reservation.end_time >= now,
    ).all()
    active_tool_ids = set(r.tool_id for r in active_reservations)

    # 2. Alle Tools holen, die aktuell borrowed=True sind
    borrowed_tools = Tool.query.filter_by(is_borrowed=True).all()

    # 3. Borrowed-Wert neu setzen
    for tool in borrowed_tools:
        # Falls Werkzeug *nicht mehr aktiv* → zurücksetzen
        if tool.id not in active_tool_ids:
            tool.is_borrowed = False

    for tid in active_tool_ids:
        tool = Tool.query.get(tid)
        if tool:
            tool.is_borrowed = True

    db.session.commit()
