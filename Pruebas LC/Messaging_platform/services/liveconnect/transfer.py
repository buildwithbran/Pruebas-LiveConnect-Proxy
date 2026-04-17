import requests

from services.liveconnect.response_normalizer import build_network_error, normalize_json_response
from services.liveconnect.token_provider import TokenProviderError, build_headers


def transfer(data):
    if not isinstance(data, dict):
        return {"ok": False, "status_code": 400, "error": "Payload JSON invalido"}

    conversation_id = str(data.get("id_conversacion", "")).strip()
    if not conversation_id:
        return {"ok": False, "status_code": 400, "error": "id_conversacion es requerido"}

    id_canal = data.get("id_canal")
    if not id_canal:
        return {"ok": False, "status_code": 400, "error": "id_canal es requerido"}

    payload = {
        "id_conversacion": conversation_id,
        "id_canal": id_canal,
        "estado": data.get("estado", 1),
    }

    mensaje = data.get("mensaje")
    if mensaje:
        payload["mensaje"] = mensaje

    id_grupo = data.get("id_grupo")
    if id_grupo:
        payload["id_grupo"] = id_grupo

    usuario = data.get("usuario")
    if usuario:
        payload["usuario"] = usuario

    contacto = data.get("contacto")
    if contacto:
        payload["contacto"] = contacto
    else:
        payload["contacto"] = {
            "nombre": data.get("contact_name", "Usuario"),
            "celular": data.get("celular", "")
        }

    try:
        headers = build_headers()
        headers["Accept"] = "application/json"
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    try:
        response = requests.post(
            "https://api.liveconnect.chat/prod/proxy/transfer",
            json=payload,
            headers=headers,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("transfer", error)

    return normalize_json_response(response).to_dict()
