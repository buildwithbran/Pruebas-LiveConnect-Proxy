import os
import tempfile
import unittest

from DB.database import SQLiteRepository
from core.webhook_processor import WebhookProcessor
from services.webhook.parse_payload import parse_payload
from services.webhook.store_message import store_message
from services.webhook.validate_message import validate_message


class WebhookPipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "webhook_pipeline.db")
        self.repository = SQLiteRepository(db_name=self.db_path)
        self.repository.init_schema()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_parse_payload_accepts_flat_legacy_shape(self):
        normalized = parse_payload(
            {
                "id_conversacion": "conv-legacy",
                "mensaje": "Hola equipo",
                "canal": "whatsapp",
            }
        )

        self.assertEqual("conv-legacy", normalized.conversation_id)
        self.assertEqual("whatsapp", normalized.canal)
        self.assertEqual("Hola equipo", normalized.message_text)
        self.assertEqual("text", normalized.message_type)
        self.assertEqual({"raw_text": "Hola equipo"}, normalized.metadata)

    def test_parse_payload_accepts_nested_provider_shape(self):
        normalized = parse_payload(
            {
                "id_conversacion": "conv-provider",
                "id_canal": 753,
                "message": {
                    "texto": "Mira https://liveconnect.chat/info",
                    "messageId": "msg-123",
                },
                "contact_data": {"name": "Brandon Gallego"},
                "timestamp": "2026-04-08T10:30:00Z",
            }
        )

        self.assertEqual("conv-provider", normalized.conversation_id)
        self.assertEqual("753", normalized.canal)
        self.assertEqual("Mira https://liveconnect.chat/info", normalized.message_text)
        self.assertEqual("link", normalized.message_type)
        self.assertEqual("Brandon Gallego", normalized.contact_name)
        self.assertEqual("msg-123", normalized.metadata["messageId"])
        self.assertEqual(["https://liveconnect.chat/info"], normalized.metadata["links"])
        self.assertEqual("2026-04-08T10:30:00Z", normalized.metadata["timestamp"])

    def test_validate_message_marks_empty_payload_as_ignored(self):
        normalized = parse_payload({"id_conversacion": "conv-empty", "message": {}, "id_canal": 1})

        result = validate_message(normalized)

        self.assertTrue(result.ok)
        self.assertTrue(result.ignored)
        self.assertEqual("Mensaje vacio ignorado", result.warning)

    def test_store_message_persists_contact_name_and_metadata(self):
        normalized = parse_payload(
            {
                "id_conversacion": "conv-save",
                "id_canal": 753,
                "message": {"texto": "Hola desde webhook", "messageUID": "uid-1"},
                "contact_data": {"name": "Camila"},
            }
        )

        stored = store_message(normalized, repository=self.repository)

        self.assertTrue(stored)
        conversations = self.repository.list_conversations()
        messages = self.repository.list_messages("conv-save")

        self.assertEqual("Camila", conversations[0]["contact_name"])
        self.assertEqual("Hola desde webhook", messages[0]["message"])
        self.assertEqual("uid-1", messages[0]["metadata"]["messageUID"])

    def test_webhook_processor_persists_file_payload(self):
        payload = {
            "id_conversacion": "conv-file",
            "id_canal": 753,
            "message": {
                "file": {
                    "url": "https://cdn.liveconnect.chat/documento.pdf",
                    "name": "documento.pdf",
                }
            },
        }

        result = WebhookProcessor(repository=self.repository).process(payload)

        self.assertEqual({"status": "ok", "ok": True}, result)
        messages = self.repository.list_messages("conv-file")
        self.assertEqual(1, len(messages))
        self.assertEqual("file", messages[0]["message_type"])
        self.assertEqual("https://cdn.liveconnect.chat/documento.pdf", messages[0]["file_url"])


if __name__ == "__main__":
    unittest.main()
