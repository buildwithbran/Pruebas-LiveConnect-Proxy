from DB.database import default_repository


def store_message(message, repository=default_repository):
    file_payload = message.file if isinstance(getattr(message, "file", None), dict) else None
    save_kwargs = {
        "conversation_id": message.conversation_id,
        "canal": message.canal,
        "sender": "usuario",
        "message": message.message_text,
        "message_type": message.message_type,
        "file_url": file_payload.get("url") if file_payload else None,
        "file_name": file_payload.get("name") if file_payload else None,
        "file_ext": file_payload.get("ext") if file_payload else None,
        "metadata": message.metadata,
    }

    if message.contact_name:
        save_kwargs["contact_name"] = message.contact_name

    try:
        repository.save_message(**save_kwargs)
    except TypeError:
        repository.save_message(
            conversation_id=message.conversation_id,
            canal=message.canal,
            sender="usuario",
            message=message.message_text,
        )

    return True
