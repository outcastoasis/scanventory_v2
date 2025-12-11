from models import db, Log
from datetime import datetime
from flask import request
from utils.permissions import get_token_payload

def write_log(action, details=None, user_id=None):
    """
    Zentrale Logging-Funktion.
    """
    if not user_id:
        # Wenn kein user_id übergeben wurde: versuche User aus Token zu laden
        payload = get_token_payload()
        if payload:
            user_id = payload["user_id"]

    if not user_id:
        user_id = 0  # Gast/Unbekannt

    log = Log(
        user_id=user_id,
        action=action,
        details=details,
        timestamp=datetime.utcnow()
    )

    db.session.add(log)
    db.session.commit()

    return True
