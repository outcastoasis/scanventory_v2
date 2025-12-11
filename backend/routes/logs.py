from flask import Blueprint, jsonify
from models import Log, User
from utils.permissions import requires_permission

logs_bp = Blueprint("logs", __name__)


@logs_bp.route("/api/logs", methods=["GET"])
@requires_permission("access_admin_panel")
def get_logs():
    logs = Log.query.order_by(Log.timestamp.desc()).limit(500).all()

    return jsonify(
        [
            {
                "id": l.id,
                "user_id": l.user_id,
                "username": l.user.username if l.user else "Unbekannt",
                "action": l.action,
                "details": l.details,
                "timestamp": l.timestamp.isoformat(),
            }
            for l in logs
        ]
    )
