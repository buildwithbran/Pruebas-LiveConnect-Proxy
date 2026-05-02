from DB.database import default_repository


def store_message(message, repository=default_repository):
    conversation_id = message.conversation_id

    if message.celular:
        existing = repository.get_conversation_by_celular(message.celular)
        if existing:
            conversation_id = existing["id"]
    elif message.contact_name:
        existing = repository.get_conversation_by_contact_name(message.contact_name, message.canal)
        if existing:
            conversation_id = existing["id"]

    file_payload = message.file if isinstance(getattr(message, "file", None), dict) else None
    save_kwargs = {
        "conversation_id": conversation_id,
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
    if message.celular:
        save_kwargs["celular"] = message.celular

    has_content = message.message_text or file_payload
    has_contact_info = message.contact_name or message.celular

    if not has_content and not has_contact_info:
        return True

    if not has_content and bool(has_contact_info):
        from DB.database import default_repository as repo
        with repo._connect() as conn:
            cursor = conn.cursor()
            if message.celular and message.contact_name:
                cursor.execute(
                    """
                    UPDATE conversations
                    SET canal = ?,
                        contact_name = ?,
                        celular = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (message.canal, message.contact_name, message.celular, conversation_id),
                )
            elif message.celular:
                cursor.execute(
                    """
                    UPDATE conversations
                    SET canal = ?,
                        celular = COALESCE(NULLIF(?, ''), celular),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (message.canal, message.celular, conversation_id),
                )
            elif message.contact_name:
                cursor.execute(
                    """
                    UPDATE conversations
                    SET canal = ?,
                        contact_name = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (message.canal, message.contact_name, conversation_id),
                )
            conn.commit()
        return True

    try:
        repository.save_message(**save_kwargs)
    except TypeError:
        repository.save_message(
            conversation_id=conversation_id,
            canal=message.canal,
            sender="usuario",
            message=message.message_text,
        )

    return True
