import requests

from DB.database import save_balance
from services.liveconnect.response_normalizer import build_network_error
from services.liveconnect.token_provider import TokenProviderError, build_headers


def get_balance(expected_idc=None):
    try:
        headers = build_headers(content_type=None)
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    try:
        response = requests.get(
            "https://api.liveconnect.chat/prod/proxy/balance",
            headers=headers,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("balance", error)

    try:
        payload = response.json()
    except ValueError:
        return {
            "ok": False,
            "status_code": response.status_code,
            "error": "Respuesta invalida del servidor",
            "raw_response": response.text,
        }

    if not response.ok:
        return {
            "ok": False,
            "status_code": response.status_code,
            "error": payload,
        }

    data = payload.get("data")
    if not isinstance(data, dict):
        return {"ok": False, "status_code": 502, "error": "No se encontro data en la respuesta"}

    idc = data.get("idc")
    balance = data.get("balance")

    if expected_idc is not None and str(idc) != str(expected_idc):
        return {
            "ok": False,
            "status_code": 409,
            "error": f"El balance recibido pertenece al idc {idc}, no a {expected_idc}",
        }

    result = {
        "ok": True,
        "status_code": response.status_code,
        "idc": idc,
        "balance": balance,
        "detail": data,
    }
    save_balance(result)
    return result
