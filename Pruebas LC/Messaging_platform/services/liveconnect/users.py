import requests

from services.liveconnect.response_normalizer import build_network_error, normalize_json_response
from services.liveconnect.token_provider import TokenProviderError, build_headers


def list_users(filters=None):
    try:
        headers = build_headers()
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    params = {}
    if filters:
        for key in ["desde", "estado", "hasta", "initFrom", "limit", "palabras", "tipo"]:
            if key in filters and filters[key]:
                params[key] = filters[key]

    try:
        response = requests.get(
            "https://api.liveconnect.chat/prod/users/list",
            headers=headers,
            params=params,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("list_users", error)

    return normalize_json_response(response).to_dict()


def list_groups(filters=None):
    try:
        headers = build_headers()
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    params = {}
    if filters:
        for key in ["archivado", "id", "publico"]:
            if key in filters and filters[key] is not None:
                params[key] = filters[key]

    try:
        response = requests.get(
            "https://api.liveconnect.chat/prod/groups/list",
            headers=headers,
            params=params,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("list_groups", error)

    return normalize_json_response(response).to_dict()
