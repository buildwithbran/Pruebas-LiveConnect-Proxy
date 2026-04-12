from DB.database import default_repository
from core.contracts import ValidationResult
from services.webhook.parse_payload import parse_payload
from services.webhook.store_message import store_message
from services.webhook.validate_message import validate_message


class WebhookProcessor:
    def __init__(self, repository=default_repository):
        self.repository = repository

    def process(self, payload):
        try:
            normalized_message = parse_payload(payload)
        except ValueError as error:
            return {"status": "error", "ok": False, "error": str(error)}

        validation = validate_message(normalized_message)
        if not isinstance(validation, ValidationResult):
            return {"status": "error", "ok": False, "error": "Respuesta de validacion invalida"}

        if not validation.ok:
            return {
                "status": "error",
                "ok": False,
                "error": validation.error or "Mensaje invalido",
            }

        if validation.ignored:
            return {
                "status": "ignored",
                "ok": True,
                "warning": validation.warning or "Mensaje vacio ignorado",
            }

        try:
            store_message(normalized_message, repository=self.repository)
        except Exception as error:
            return {
                "status": "error",
                "ok": False,
                "error": f"No se pudo guardar el mensaje: {str(error)}",
            }

        return {"status": "ok", "ok": True}
