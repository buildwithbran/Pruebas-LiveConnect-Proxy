from DB.database import get_messages as repository_get_messages


def get_messages(conversation_id, cursor=None, limit=20):
    data = repository_get_messages(conversation_id, cursor=cursor, limit=limit)
    messages = data.get("messages") if isinstance(data, dict) else []
    normalized = []

    for message in messages:
        sender = "usuario" if message.get("sender") == "usuario" else "agent"
        text = message.get("message")
        if isinstance(text, str):
            text = text.strip()
        elif isinstance(text, (int, float, bool)):
            text = str(text).strip()
        else:
            text = ""
        if not text:
            continue
        normalized.append(
            {
                "id": message.get("id"),
                "sender": sender,
                "message": text,
                "message_type": message.get("message_type") or "text",
                "file_url": message.get("file_url"),
                "file_name": message.get("file_name"),
                "file_ext": message.get("file_ext"),
                "metadata": message.get("metadata"),
                "created_at": message.get("created_at"),
            }
        )

    return {
        "messages": normalized,
        "next_cursor": data.get("next_cursor") if isinstance(data, dict) else None,
        "has_more": data.get("has_more") if isinstance(data, dict) else False,
    }
