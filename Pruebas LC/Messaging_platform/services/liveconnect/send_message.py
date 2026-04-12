import warnings

import requests

from DB.database import save_message
from services.liveconnect.response_normalizer import build_network_error, normalize_json_response
from services.liveconnect.token_provider import TokenProviderError, build_headers


def _normalize_text(value):
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    return ""


def send_message(data):
    if not isinstance(data, dict):
        return {"ok": False, "status_code": 400, "error": "Payload JSON invalido"}

    conversation_id = _normalize_text(data.get("id_conversacion"))
    message_text = _normalize_text(data.get("mensaje"))

    if not conversation_id:
        return {"ok": False, "status_code": 400, "error": "id_conversacion es requerido"}
    if not message_text:
        return {"ok": False, "status_code": 400, "error": "mensaje es requerido"}

    try:
        headers = build_headers()
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    payload = {"id_conversacion": conversation_id, "mensaje": message_text}

    try:
        response = requests.post(
            "https://api.liveconnect.chat/prod/proxy/sendMessage",
            json=payload,
            headers=headers,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("sendMessage", error)

    response_payload = normalize_json_response(response).to_dict()

    if response.ok:
        canal = _normalize_text(data.get("canal") or data.get("id_canal") or "proxy") or "proxy"
        try:
            save_message(conversation_id, canal, "agent", message_text)
        except Exception as error:
            existing = response_payload.get("warnings")
            if not isinstance(existing, list):
                existing = []
            existing.append(f"No se pudo guardar el mensaje localmente: {str(error)}")
            response_payload["warnings"] = existing
            warnings.warn(str(error), RuntimeWarning, stacklevel=2)

    return response_payload
