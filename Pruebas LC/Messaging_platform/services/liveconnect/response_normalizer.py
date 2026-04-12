from core.contracts import ProviderResult


def normalize_json_response(response):
    try:
        payload = response.json()
    except ValueError:
        payload = {"raw_response": response.text}

    return ProviderResult(
        ok=bool(response.ok),
        status_code=int(response.status_code),
        payload=payload,
    )


def build_network_error(operation_name, error, status_code=502):
    return ProviderResult(
        ok=False,
        status_code=status_code,
        error=f"Error de red en {operation_name}: {str(error)}",
    ).to_dict()
