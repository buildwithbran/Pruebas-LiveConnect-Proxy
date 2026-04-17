from core.contracts import ProviderResult


def normalize_json_response(response):
    try:
        text = response.text.strip()
        if not text:
            payload = {}
        else:
            payload = response.json()
    except ValueError:
        payload = {"raw_response": response.text}

    is_success = response.status_code == 200 and (
        not payload or payload.get("status") == 1
    )

    return ProviderResult(
        ok=is_success,
        status_code=int(response.status_code),
        payload=payload,
    )


def build_network_error(operation_name, error, status_code=502):
    return ProviderResult(
        ok=False,
        status_code=status_code,
        error=f"Error de red en {operation_name}: {str(error)}",
    ).to_dict()
