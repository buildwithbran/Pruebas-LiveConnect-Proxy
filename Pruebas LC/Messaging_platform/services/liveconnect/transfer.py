import requests

from services.liveconnect.response_normalizer import build_network_error, normalize_json_response
from services.liveconnect.token_provider import TokenProviderError, build_headers


def transfer(data):
    if not isinstance(data, dict):
        return {"ok": False, "status_code": 400, "error": "Payload JSON invalido"}

    conversation_id = str(data.get("id_conversacion", "")).strip()
    if not conversation_id:
        return {"ok": False, "status_code": 400, "error": "id_conversacion es requerido"}

    try:
        headers = build_headers()
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    try:
        response = requests.post(
            "https://api.liveconnect.chat/prod/proxy/transfer",
            json=data,
            headers=headers,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("transfer", error)

    return normalize_json_response(response).to_dict()
