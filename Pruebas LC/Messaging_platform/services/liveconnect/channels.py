import requests

from services.liveconnect.response_normalizer import build_network_error, normalize_json_response
from services.liveconnect.token_provider import TokenProviderError, build_headers


def get_channels(filters=None):
    try:
        headers = build_headers(content_type=None, accept="application/json")
    except TokenProviderError as error:
        return {"ok": False, "status_code": 502, "error": str(error)}

    clean_filters = {}
    if isinstance(filters, dict):
        for key, value in filters.items():
            if value is not None and str(value).strip() != "":
                clean_filters[key] = value

    try:
        response = requests.get(
            "https://api.liveconnect.chat/prod/channels/list",
            headers=headers,
            params=clean_filters,
            timeout=20,
        )
    except requests.RequestException as error:
        return build_network_error("channels/list", error)

    return normalize_json_response(response).to_dict()
