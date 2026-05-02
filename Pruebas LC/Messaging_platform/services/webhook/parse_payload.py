import re

from core.contracts import NormalizedIncomingMessage


URL_PATTERN = re.compile(r"https?://[^\s]+", flags=re.IGNORECASE)


def _normalize_text(value):
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    return ""


def _get_message_object(data):
    message_obj = data.get("message")
    if isinstance(message_obj, dict):
        return message_obj
    return {}


def _extract_message_text(data):
    top_level_text = _normalize_text(data.get("mensaje"))
    if top_level_text:
        return top_level_text

    message_obj = _get_message_object(data)
    for key in ("texto", "mensaje", "message"):
        text = _normalize_text(message_obj.get(key))
        if text:
            return text

    return ""


def _extract_urls(message_text):
    if not message_text:
        return []

    urls = []
    for match in URL_PATTERN.findall(message_text):
        cleaned = match.strip().rstrip(".,;!?)")
        if cleaned and cleaned not in urls:
            urls.append(cleaned)
    return urls


def _extract_file_payload(data):
    file_obj = data.get("file")
    if not isinstance(file_obj, dict):
        message_obj = _get_message_object(data)
        file_obj = message_obj.get("file")

    if not isinstance(file_obj, dict):
        return None

    file_url = _normalize_text(file_obj.get("url"))
    if not file_url:
        return None

    file_name = _normalize_text(file_obj.get("name")) or _normalize_text(file_obj.get("nombre"))
    file_ext = _normalize_text(file_obj.get("ext")) or _normalize_text(file_obj.get("extension"))

    if not file_ext and file_name and "." in file_name:
        file_ext = file_name.rsplit(".", 1)[1]

    if not file_ext:
        url_without_query = file_url.split("?", 1)[0]
        if "." in url_without_query:
            file_ext = url_without_query.rsplit(".", 1)[1]

    normalized_name = file_name or file_url.split("/")[-1] or "archivo"
    normalized_ext = file_ext.lower().lstrip(".")

    return {
        "url": file_url,
        "name": normalized_name,
        "ext": normalized_ext,
        "tipo": file_obj.get("tipo"),
        "width": file_obj.get("width"),
        "height": file_obj.get("height"),
    }


def _build_file_marker(file_payload):
    if not isinstance(file_payload, dict):
        return ""

    file_url = _normalize_text(file_payload.get("url"))
    file_name = _normalize_text(file_payload.get("name"))
    file_ext = _normalize_text(file_payload.get("ext")).lower().lstrip(".")

    if not file_url:
        return ""

    return f"[FILE]|{file_url}|{file_name}|{file_ext}"


def _build_message_type(message_obj, file_payload, urls):
    if file_payload and file_payload.get("url"):
        return "file"
    if urls:
        return "link"

    has_metadata = any(
        key in message_obj
        for key in ("messageId", "messageUID", "timestamp", "interno", "f_id", "f_tipo")
    )
    if has_metadata:
        return "structured"
    return "text"


def _build_metadata(data, message_obj, file_payload, urls):
    metadata = {}

    for key in ("messageId", "messageUID", "tipo", "timestamp", "interno", "f_id", "f_tipo"):
        value = message_obj.get(key)
        if value is not None:
            metadata[key] = value

    top_level_timestamp = data.get("timestamp")
    if top_level_timestamp is not None and "timestamp" not in metadata:
        metadata["timestamp"] = top_level_timestamp

    if urls:
        metadata["links"] = urls

    if file_payload:
        file_metadata = {}
        for key in ("name", "ext", "tipo", "width", "height"):
            value = file_payload.get(key)
            if value is not None and value != "":
                file_metadata[key] = value
        if file_metadata:
            metadata["file"] = file_metadata

    raw_text = _extract_message_text(data)
    if raw_text:
        metadata["raw_text"] = raw_text

    return metadata or None


def _extract_contact_name(data):
    if isinstance(data.get("contact_name"), str):
        normalized = data["contact_name"].strip()
        if normalized:
            return normalized

    if isinstance(data.get("nombre"), str):
        normalized = data["nombre"].strip()
        if normalized:
            return normalized

    contacto = data.get("contacto")
    if isinstance(contacto, dict):
        name = contacto.get("nombre") or contacto.get("name")
        if isinstance(name, str):
            normalized = name.strip()
            if normalized:
                return normalized

    contact_data = data.get("contact_data")
    if isinstance(contact_data, dict):
        name = contact_data.get("name")
        if isinstance(name, str):
            normalized = name.strip()
            if normalized:
                return normalized

    return None


def _extract_celular(data):
    celular = _normalize_text(data.get("celular"))
    if celular:
        return celular

    contacto = data.get("contacto")
    if isinstance(contacto, dict):
        celular = _normalize_text(contacto.get("celular"))
        if celular:
            return celular

    contact_data = data.get("contact_data")
    if isinstance(contact_data, dict):
        celular = _normalize_text(contact_data.get("celular"))
        if celular:
            return celular

    message_obj = _get_message_object(data)
    if message_obj:
        f_id = message_obj.get("f_id")
        if f_id is not None:
            return _normalize_text(f_id)

    return None


def _resolve_channel(data):
    canal = _normalize_text(data.get("canal"))
    if canal:
        return canal

    channel_id = _normalize_text(data.get("id_canal"))
    if channel_id:
        return channel_id

    return "unknown"


def parse_payload(data):
    if not isinstance(data, dict):
        raise ValueError("Payload JSON invalido")

    conversation_id = _normalize_text(data.get("id_conversacion"))
    if not conversation_id:
        raise ValueError("id_conversacion es requerido")

    message_obj = _get_message_object(data)
    message_text = _extract_message_text(data)
    urls = _extract_urls(message_text)
    file_payload = _extract_file_payload(data)
    file_marker = _build_file_marker(file_payload)
    final_message = file_marker or message_text

    return NormalizedIncomingMessage(
        conversation_id=conversation_id,
        canal=_resolve_channel(data),
        message_text=final_message,
        message_type=_build_message_type(message_obj, file_payload, urls),
        file=file_payload,
        contact_name=_extract_contact_name(data),
        celular=_extract_celular(data),
        metadata=_build_metadata(data, message_obj, file_payload, urls),
    )
