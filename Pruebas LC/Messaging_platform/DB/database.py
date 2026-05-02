import json
import sqlite3
from dataclasses import dataclass

from services.realtime import publish

DB_NAME = "database.db"


@dataclass
class SQLiteRepository:
    db_name: str = DB_NAME

    def _connect(self):
        return sqlite3.connect(self.db_name)

    @staticmethod
    def _normalize_message_text(message):
        if isinstance(message, str):
            normalized = message.strip()
            return normalized

        if isinstance(message, (int, float, bool)):
            normalized = str(message).strip()
            return normalized

        return ""

    @staticmethod
    def _normalize_contact_name(contact_name):
        if not isinstance(contact_name, str):
            return None
        normalized = contact_name.strip()
        return normalized if normalized else None

    @staticmethod
    def _normalize_optional_text(value):
        if isinstance(value, str):
            normalized = value.strip()
            return normalized if normalized else None
        if isinstance(value, (int, float, bool)):
            normalized = str(value).strip()
            return normalized if normalized else None
        return None

    @staticmethod
    def _normalize_message_type(message_type, has_file_url):
        if has_file_url:
            return "file"

        if not isinstance(message_type, str):
            return "text"

        normalized = message_type.strip().lower()
        allowed = {"text", "file", "link", "structured"}
        if normalized in allowed:
            return normalized
        return "text"

    @staticmethod
    def _normalize_metadata(metadata):
        if metadata is None:
            return None

        if isinstance(metadata, str):
            normalized = metadata.strip()
            return normalized if normalized else None

        if isinstance(metadata, (dict, list)):
            try:
                return json.dumps(metadata, ensure_ascii=False)
            except (TypeError, ValueError):
                return None

        return None

    @staticmethod
    def _deserialize_metadata(raw_metadata):
        if not isinstance(raw_metadata, str):
            return None
        normalized = raw_metadata.strip()
        if not normalized:
            return None
        try:
            parsed = json.loads(normalized)
            if isinstance(parsed, (dict, list)):
                return parsed
        except json.JSONDecodeError:
            pass
        return {"raw": normalized}

    def init_schema(self):
        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    canal TEXT,
                    contact_name TEXT,
                    archived INTEGER DEFAULT 0,
                    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_message_from TEXT DEFAULT 'client',
                    unread_count INTEGER DEFAULT 0,
                    last_agent_response_at DATETIME,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT,
                    sender TEXT,
                    message TEXT,
                    message_type TEXT DEFAULT 'text',
                    file_url TEXT,
                    file_name TEXT,
                    file_ext TEXT,
                    metadata TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS system_config (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
                """
            )

            cursor.execute("PRAGMA table_info(conversations)")
            conversation_columns = {row[1] for row in cursor.fetchall()}
            if "contact_name" not in conversation_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN contact_name TEXT")
            if "celular" not in conversation_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN celular TEXT")
            if "archived" not in conversation_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN archived INTEGER DEFAULT 0")
            if "last_message_at" not in conversation_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN last_message_at DATETIME")
            if "last_message_from" not in conversation_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN last_message_from TEXT DEFAULT 'client'")
            if "unread_count" not in conversation_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN unread_count INTEGER DEFAULT 0")
            if "last_agent_response_at" not in conversation_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN last_agent_response_at DATETIME")

            cursor.execute("PRAGMA table_info(messages)")
            message_columns = {row[1] for row in cursor.fetchall()}
            if "message_type" not in message_columns:
                cursor.execute("ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text'")
            if "file_url" not in message_columns:
                cursor.execute("ALTER TABLE messages ADD COLUMN file_url TEXT")
            if "file_name" not in message_columns:
                cursor.execute("ALTER TABLE messages ADD COLUMN file_name TEXT")
            if "file_ext" not in message_columns:
                cursor.execute("ALTER TABLE messages ADD COLUMN file_ext TEXT")
            if "metadata" not in message_columns:
                cursor.execute("ALTER TABLE messages ADD COLUMN metadata TEXT")

    def save_message(
        self,
        conversation_id,
        canal,
        sender,
        message,
        contact_name=None,
        celular=None,
        message_type=None,
        file_url=None,
        file_name=None,
        file_ext=None,
        metadata=None,
    ):
        normalized_conversation_id = str(conversation_id or "").strip()
        normalized_canal = str(canal or "").strip() or "unknown"
        normalized_sender = str(sender or "").strip() or "usuario"
        normalized_message = self._normalize_message_text(message)
        normalized_contact_name = self._normalize_contact_name(contact_name)
        normalized_celular = self._normalize_optional_text(celular)
        normalized_file_url = self._normalize_optional_text(file_url)
        normalized_file_name = self._normalize_optional_text(file_name)
        normalized_file_ext = self._normalize_optional_text(file_ext)
        normalized_metadata = self._normalize_metadata(metadata)
        normalized_message_type = self._normalize_message_type(
            message_type=message_type,
            has_file_url=bool(normalized_file_url),
        )

        if not normalized_conversation_id:
            raise ValueError("conversation_id es requerido")

        if not normalized_message:
            if normalized_file_name:
                normalized_message = f"[Archivo] {normalized_file_name}"
            elif normalized_file_url:
                normalized_message = normalized_file_url

        if not normalized_message:
            return False

        normalized_last_message_from = "client"
        if normalized_sender.lower() in {"agente", "agent"}:
            normalized_last_message_from = "agent"
        elif normalized_sender.lower() not in {"usuario", "client"}:
            normalized_last_message_from = "system"

        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO conversations (
                    id,
                    canal,
                    contact_name,
                    celular,
                    last_message_at,
                    last_message_from,
                    unread_count,
                    last_agent_response_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    canal = excluded.canal,
                    contact_name = CASE
                        WHEN excluded.contact_name IS NULL OR excluded.contact_name = ''
                        THEN conversations.contact_name
                        ELSE excluded.contact_name
                    END,
                    celular = CASE
                        WHEN excluded.celular IS NULL OR excluded.celular = ''
                        THEN conversations.celular
                        ELSE excluded.celular
                    END,
                    last_message_at = CURRENT_TIMESTAMP,
                    last_message_from = excluded.last_message_from,
                    unread_count = CASE
                        WHEN excluded.last_message_from = 'client' THEN COALESCE(conversations.unread_count, 0) + 1
                        ELSE 0
                    END,
                    last_agent_response_at = CASE
                        WHEN excluded.last_message_from = 'agent' THEN CURRENT_TIMESTAMP
                        ELSE conversations.last_agent_response_at
                    END,
                    archived = CASE
                        WHEN excluded.last_message_from = 'client' THEN 0
                        ELSE conversations.archived
                    END,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    normalized_conversation_id,
                    normalized_canal,
                    normalized_contact_name,
                    normalized_celular,
                    normalized_last_message_from,
                    1 if normalized_last_message_from == "client" else 0,
                    normalized_last_message_from,
                ),
            )
            cursor.execute(
                """
                INSERT INTO messages (
                    conversation_id,
                    sender,
                    message,
                    message_type,
                    file_url,
                    file_name,
                    file_ext,
                    metadata
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    normalized_conversation_id,
                    normalized_sender,
                    normalized_message,
                    normalized_message_type,
                    normalized_file_url,
                    normalized_file_name,
                    normalized_file_ext,
                    normalized_metadata,
                ),
            )
            message_id = cursor.lastrowid
            cursor.execute(
                "SELECT created_at FROM messages WHERE id = ?",
                (message_id,),
            )
            created_at_row = cursor.fetchone()
            created_at = created_at_row[0] if created_at_row else None

        publish(
            "message.updated",
            {
                "conversation_id": normalized_conversation_id,
                "canal": normalized_canal,
                "sender": normalized_sender,
                "message_type": normalized_message_type,
                "contact_name": normalized_contact_name,
                "message_id": message_id,
                "message": normalized_message,
                "file_url": normalized_file_url,
                "file_name": normalized_file_name,
                "file_ext": normalized_file_ext,
                "metadata": normalized_metadata,
                "created_at": created_at,
            },
        )
        return True

    def list_conversations(self):
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT
                    id,
                    canal,
                    contact_name,
                    celular,
                    archived,
                    last_message_at,
                    COALESCE(last_message_from, 'client') AS last_message_from,
                    COALESCE(unread_count, 0) AS unread_count,
                    last_agent_response_at,
                    updated_at,
                    CAST((julianday('now') - julianday(COALESCE(last_message_at, updated_at))) * 24 * 60 AS INTEGER) AS minutes_since_last_message
                FROM conversations
                ORDER BY (minutes_since_last_message * 2 + CASE WHEN COALESCE(last_message_from, 'client') = 'client' THEN 50 ELSE 0 END) DESC,
                    COALESCE(last_message_at, updated_at) DESC
                """
            )
            rows = cursor.fetchall()
        conversations = []
        for row in rows:
            priority_score = row[10] * 2 + (50 if row[6] == 'client' else 0)
            conversations.append(
                {
                    "id": row[0],
                    "canal": row[1],
                    "contact_name": row[2],
                    "celular": row[3],
                    "archived": bool(row[4]),
                    "last_message_at": row[5],
                    "last_message_from": row[6],
                    "unread_count": row[7],
                    "last_agent_response_at": row[8],
                    "updated_at": row[9],
                    "priority_score": priority_score,
                }
            )
        return conversations

    def get_conversation_by_celular(self, celular):
        if not celular:
            return None
        normalized_celular = self._normalize_optional_text(celular)
        if not normalized_celular:
            return None
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, canal, contact_name, celular, updated_at
                FROM conversations
                WHERE celular = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (normalized_celular,),
            )
            row = cursor.fetchone()
        if row:
            return {"id": row[0], "canal": row[1], "contact_name": row[2], "celular": row[3], "updated_at": row[4]}
        return None

    def get_conversation_by_contact_name(self, contact_name, canal=None):
        if not contact_name:
            return None
        normalized_name = self._normalize_contact_name(contact_name)
        if not normalized_name:
            return None
        with self._connect() as conn:
            cursor = conn.cursor()
            if canal:
                cursor.execute(
                    """
                    SELECT id, canal, contact_name, celular, updated_at
                    FROM conversations
                    WHERE contact_name = ? AND canal = ?
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    (normalized_name, canal),
                )
            else:
                cursor.execute(
                    """
                    SELECT id, canal, contact_name, celular, updated_at
                    FROM conversations
                    WHERE contact_name = ?
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    (normalized_name,),
                )
            row = cursor.fetchone()
        if row:
            return {"id": row[0], "canal": row[1], "contact_name": row[2], "celular": row[3], "updated_at": row[4]}
        return None

    def list_messages(self, conversation_id, cursor=None, limit=20):
        limit_value = max(1, min(100, int(limit or 20)))
        query_limit = limit_value + 1
        params = [conversation_id]
        cursor_condition = ""

        cursor_created_at = None
        cursor_id = None
        if cursor:
            try:
                cursor_parts = str(cursor).split("|", 1)
                cursor_created_at = cursor_parts[0]
                cursor_id = int(cursor_parts[1]) if len(cursor_parts) > 1 else None
            except Exception:
                cursor_created_at = None
                cursor_id = None

        if cursor_created_at and cursor_id is not None:
            cursor_condition = (
                "AND (created_at < ? OR (created_at = ? AND id < ?))"
            )
            params.extend([cursor_created_at, cursor_created_at, cursor_id])

        with self._connect() as conn:
            cursor_obj = conn.cursor()
            cursor_obj.execute(
                f"""
                SELECT id, sender, message, message_type, file_url, file_name, file_ext, metadata, created_at
                FROM messages
                WHERE conversation_id = ?
                  AND TRIM(COALESCE(message, '')) <> ''
                  {cursor_condition}
                ORDER BY created_at DESC, id DESC
                LIMIT ?
                """,
                (*params, query_limit),
            )
            rows = cursor_obj.fetchall()

        has_more = len(rows) > limit_value
        if has_more:
            rows = rows[:limit_value]

        rows.reverse()

        next_cursor = None
        if has_more and rows:
            oldest = rows[0]
            next_cursor = f"{oldest[8]}|{oldest[0]}"

        messages = [
            {
                "id": row[0],
                "sender": row[1],
                "message": row[2],
                "message_type": row[3],
                "file_url": row[4],
                "file_name": row[5],
                "file_ext": row[6],
                "metadata": self._deserialize_metadata(row[7]),
                "created_at": row[8],
            }
            for row in rows
        ]

        return {"messages": messages, "next_cursor": next_cursor, "has_more": has_more}

    def set_conversation_archived(self, conversation_id, archived=True):
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE conversations
                SET archived = ?
                WHERE id = ?
                """,
                (1 if archived else 0, conversation_id),
            )

    def mark_conversation_read(self, conversation_id):
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE conversations
                SET unread_count = 0
                WHERE id = ?
                """,
                (conversation_id,),
            )

    def set_conversation_archived(self, conversation_id, archived=True):
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE conversations
                SET archived = ?
                WHERE id = ?
                """,
                (1 if archived else 0, conversation_id),
            )

    def mark_conversation_read(self, conversation_id):
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE conversations
                SET unread_count = 0
                WHERE id = ?
                """,
                (conversation_id,),
            )

    def save_balance(self, balance_data):
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO system_config (key, value)
                VALUES (?, ?)
                """,
                ("balance", json.dumps(balance_data)),
            )

    def get_cached_balance(self):
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT value FROM system_config
                WHERE key = ?
                """,
                ("balance",),
            )
            row = cursor.fetchone()

        if row:
            return json.loads(row[0])
        return None


default_repository = SQLiteRepository()


def get_db():
    return sqlite3.connect(DB_NAME)


def init_db():
    default_repository.init_schema()


def save_message(
    conversation_id,
    canal,
    sender,
    message,
    contact_name=None,
    celular=None,
    message_type=None,
    file_url=None,
    file_name=None,
    file_ext=None,
    metadata=None,
):
    return default_repository.save_message(
        conversation_id=conversation_id,
        canal=canal,
        sender=sender,
        message=message,
        contact_name=contact_name,
        celular=celular,
        message_type=message_type,
        file_url=file_url,
        file_name=file_name,
        file_ext=file_ext,
        metadata=metadata,
    )


def get_conversations():
    return default_repository.list_conversations()

def get_messages(conversation_id, cursor=None, limit=20):
    return default_repository.list_messages(conversation_id, cursor=cursor, limit=limit)

def get_conversation_by_celular(celular):
    return default_repository.get_conversation_by_celular(celular)

def get_conversation_by_contact_name(contact_name, canal=None):
    return default_repository.get_conversation_by_contact_name(contact_name, canal)


def save_balance(balance_data):
    default_repository.save_balance(balance_data)


def get_cached_balance():
    return default_repository.get_cached_balance()
