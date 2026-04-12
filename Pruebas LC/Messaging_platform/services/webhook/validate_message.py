from core.contracts import ValidationResult


def validate_message(message):
    if not getattr(message, "conversation_id", ""):
        return ValidationResult(ok=False, error="id_conversacion es requerido")

    if getattr(message, "message_text", ""):
        return ValidationResult(ok=True)

    file_payload = getattr(message, "file", None)
    if isinstance(file_payload, dict) and str(file_payload.get("url") or "").strip():
        return ValidationResult(ok=True)

    return ValidationResult(ok=True, ignored=True, warning="Mensaje vacio ignorado")
