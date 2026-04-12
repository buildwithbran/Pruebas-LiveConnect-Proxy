import json
import unittest

from services.realtime import format_sse, publish, subscribe, unsubscribe


class RealtimeServiceTests(unittest.TestCase):
    def test_publish_delivers_message_to_subscriber(self):
        subscriber_id, queue = subscribe()
        try:
            publish("message.updated", {"conversation_id": "conv-1"})
            event = queue.get(timeout=1)
        finally:
            unsubscribe(subscriber_id)

        self.assertEqual("message.updated", event["type"])
        self.assertEqual({"conversation_id": "conv-1"}, event["payload"])

    def test_format_sse_serializes_event_payload(self):
        payload = {"conversation_id": "conv-2", "ok": True}

        serialized = format_sse("stream.ready", payload)

        self.assertIn("event: stream.ready", serialized)
        self.assertIn(f"data: {json.dumps(payload, ensure_ascii=False)}", serialized)


if __name__ == "__main__":
    unittest.main()
