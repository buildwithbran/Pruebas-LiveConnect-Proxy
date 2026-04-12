import requests

from services.liveconnect.response_normalizer import build_network_error, normalize_json_response
from services.liveconnect.token_provider import TokenProviderError, build_headers


def set_webhook(data):
    if not isinstance(data, dict):
        return {"ok": False, "status_code": 400, "error": "Payload JSON invalido"}

    try:
        headers = build_headers()
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    try:
        response = requests.post(
            "https://api.liveconnect.chat/prod/proxy/setWebhook",
            json=data,
            headers=headers,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("setWebhook", error)

    return normalize_json_response(response).to_dict()


def get_webhook(id_canal):
    normalized_channel = str(id_canal).strip()
    if not normalized_channel:
        return {"ok": False, "status_code": 400, "error": "id_canal es requerido"}

    try:
        headers = build_headers()
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    try:
        response = requests.post(
            "https://api.liveconnect.chat/prod/proxy/getWebhook",
            json={"id_canal": normalized_channel},
            headers=headers,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("getWebhook", error)

    return normalize_json_response(response).to_dict()
