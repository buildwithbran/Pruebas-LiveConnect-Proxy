import os
import time

import requests
from dotenv import load_dotenv


TOKEN = None
TOKEN_EXPIRA = 0


class TokenProviderError(RuntimeError):
    pass


def reset_token_cache():
    global TOKEN, TOKEN_EXPIRA
    TOKEN = None
    TOKEN_EXPIRA = 0


def get_token():
    global TOKEN, TOKEN_EXPIRA

    load_dotenv()
    KEY = os.getenv("LIVECONNECT_KEY", "").strip()
    SECRET = os.getenv("LIVECONNECT_SECRET", "").strip()

    if not KEY or not SECRET:
        raise TokenProviderError("Se requiere un cKey y un privateKey")

    if TOKEN and time.time() < TOKEN_EXPIRA:
        return TOKEN

    try:
        response = requests.post(
            "https://api.liveconnect.chat/prod/account/token",
            json={"cKey": KEY, "privateKey": SECRET},
            headers={"Accept": "application/json, application/xml"},
            timeout=20,
        )
    except requests.RequestException as error:
        raise TokenProviderError(f"No se pudo obtener el token: {str(error)}") from error

    try:
        payload = response.json()
    except ValueError as error:
        raise TokenProviderError("Respuesta invalida solicitando token") from error

    if payload.get("status") != 1:
        raise TokenProviderError(f"Error solicitando token: {payload.get('status_message', 'Error desconocido')}")

    token = str(payload.get("PageGearToken") or "").strip()
    if not token:
        raise TokenProviderError("No se encontro PageGearToken en la respuesta")

    TOKEN = token
    TOKEN_EXPIRA = time.time() + 28800 - 60
    return TOKEN


def build_headers(content_type="application/json", accept=None):
    headers = {"PageGearToken": get_token()}
    if content_type:
        headers["Content-Type"] = content_type
    if accept:
        headers["Accept"] = accept
    return headers
