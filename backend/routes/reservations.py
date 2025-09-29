# backend/routes/reservations.py
from flask import Blueprint, request, jsonify
from models import db, User, Tool, Reservation
from datetime import datetime, timedelta
from pytz import timezone
import pytz

reservation_bp = Blueprint('reservations', __name__)

@reservation_bp.route('', methods=['POST'])
def create_reservation():
    data = request.get_json()

    user_code = data.get('user')
    tool_code = data.get('tool')
    duration = int(data.get('duration'))

    if not user_code or not tool_code or not duration:
        return jsonify({'error': 'Missing fields'}), 400

    user = User.query.filter_by(code=user_code).first()
    if not user:
        user = User(code=user_code)
        db.session.add(user)

    tool = Tool.query.filter_by(code=tool_code).first()
    if not tool:
        tool = Tool(code=tool_code)
        db.session.add(tool)
        db.session.flush()  # Tool-ID bereitstellen

    # ⛔️ Prüfen, ob Werkzeug aktuell ausgeliehen ist
    if tool.is_borrowed:
        return jsonify({'error': 'Werkzeug ist bereits ausgeliehen'}), 400

    # Zeitlogik
    zurich = timezone("Europe/Zurich")
    now_local = datetime.now(zurich)
    end_local = now_local.replace(hour=23, minute=59, second=0, microsecond=0) + timedelta(days=duration - 1)
    start_time = now_local.astimezone(pytz.utc)
    end_time = end_local.astimezone(pytz.utc)

    reservation = Reservation(
        user=user,
        tool=tool,
        start_time=start_time,
        end_time=end_time
    )
    db.session.add(reservation)

    # ✅ Werkzeugstatus setzen
    tool.is_borrowed = True

    db.session.commit()

    return jsonify({'message': 'Reservation saved'}), 201


@reservation_bp.route('', methods=['GET'])
def get_reservations():
    from_zone = pytz.utc
    to_zone = timezone("Europe/Zurich")

    reservations = Reservation.query.order_by(Reservation.start_time.desc()).all()
    result = []

    for res in reservations:
        start_local = res.start_time.replace(tzinfo=pytz.utc).astimezone(to_zone)
        end_local = res.end_time.replace(tzinfo=pytz.utc).astimezone(to_zone)

        result.append({
            "id": res.id,
            "user": res.user.code,
            "tool": res.tool.code,
            "start": start_local.strftime('%Y-%m-%d %H:%M'),
            "end": end_local.strftime('%Y-%m-%d %H:%M'),
        })

    return jsonify(result)

@reservation_bp.route('/return-tool', methods=['PATCH'])
def return_tool():
    data = request.get_json()
    tool_code = data.get('tool')

    if not tool_code:
        return jsonify({'error': 'Missing tool code'}), 400

    tool = Tool.query.filter_by(code=tool_code).first()
    if not tool:
        return jsonify({'error': 'Tool not found'}), 404

    # Letzte Reservation des Tools suchen
    reservation = Reservation.query.filter_by(tool_id=tool.id).order_by(Reservation.start_time.desc()).first()

    if not reservation or reservation.end_time < datetime.utcnow():
        return jsonify({'error': 'Keine aktive Ausleihe gefunden'}), 404

    # Rückgabe = Jetzt als neue Endzeit setzen
    reservation.end_time = datetime.utcnow()

    # Werkzeug freigeben
    tool.is_borrowed = False

    db.session.commit()

    return jsonify({'message': 'Werkzeug zurückgegeben'}), 200

