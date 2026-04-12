import unittest
from unittest.mock import patch

from services.liveconnect.balance import get_balance
from services.liveconnect.channels import get_channels
from services.liveconnect.send_file import send_file
from services.liveconnect.send_message import send_message
from services.liveconnect.send_quick_answer import send_quick_answer
from services.liveconnect.transfer import transfer
from services.liveconnect.webhook_config import get_webhook, set_webhook


class MockResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.ok = 200 <= status_code < 300
        self.text = str(payload)

    def json(self):
        return self._payload


class LiveConnectServiceTests(unittest.TestCase):
    @patch("services.liveconnect.send_message.save_message")
    @patch("services.liveconnect.send_message.requests.post")
    @patch(
        "services.liveconnect.send_message.build_headers",
        return_value={"PageGearToken": "token", "Content-Type": "application/json"},
    )
    def test_send_message_persists_outbound_message(self, _mock_headers, mock_post, mock_save_message):
        mock_post.return_value = MockResponse(200, {"detail": "sent"})

        result = send_message({"id_conversacion": "conv-1", "mensaje": "Hola"})

        self.assertTrue(result["ok"])
        self.assertEqual(200, result["status_code"])
        mock_save_message.assert_called_once_with("conv-1", "proxy", "agent", "Hola")

    @patch("services.liveconnect.send_file.save_message")
    @patch("services.liveconnect.send_file.requests.post")
    @patch(
        "services.liveconnect.send_file.build_headers",
        return_value={"PageGearToken": "token", "Content-Type": "application/json"},
    )
    def test_send_file_persists_visual_message_and_metadata(
        self,
        _mock_headers,
        mock_post,
        mock_save_message,
    ):
        mock_post.return_value = MockResponse(200, {"detail": "sent"})

        result = send_file(
            {
                "id_conversacion": "conv-2",
                "url": "https://cdn.liveconnect.chat/archivo.pdf",
                "nombre": "archivo",
                "extension": "pdf",
            }
        )

        self.assertTrue(result["ok"])
        self.assertEqual(200, result["status_code"])
        mock_save_message.assert_called_once()
        kwargs = mock_save_message.call_args.kwargs
        self.assertEqual("Archivo enviado: archivo.pdf", kwargs["message"])
        self.assertEqual("file", kwargs["message_type"])
        self.assertEqual("archivo.pdf", kwargs["file_name"])

    @patch("services.liveconnect.send_quick_answer.save_message")
    @patch("services.liveconnect.send_quick_answer.requests.post")
    @patch(
        "services.liveconnect.send_quick_answer.build_headers",
        return_value={"PageGearToken": "token", "Content-Type": "application/json"},
    )
    def test_send_quick_answer_persists_rendered_message(
        self,
        _mock_headers,
        mock_post,
        mock_save_message,
    ):
        mock_post.return_value = MockResponse(200, {"message": {"texto": "Respuesta enviada"}})

        result = send_quick_answer(
            {
                "id_conversacion": "conv-3",
                "id_respuesta": 42,
                "variables": {"nombre": "Luisa"},
            }
        )

        self.assertTrue(result["ok"])
        self.assertEqual(200, result["status_code"])
        mock_save_message.assert_called_once_with("conv-3", "proxy", "agent", "Respuesta enviada")

    @patch("services.liveconnect.transfer.requests.post")
    @patch(
        "services.liveconnect.transfer.build_headers",
        return_value={"PageGearToken": "token", "Content-Type": "application/json"},
    )
    def test_transfer_returns_normalized_provider_result(self, _mock_headers, mock_post):
        mock_post.return_value = MockResponse(202, {"status": "queued"})

        result = transfer({"id_conversacion": "conv-4", "estado": 1})

        self.assertTrue(result["ok"])
        self.assertEqual(202, result["status_code"])
        self.assertEqual("queued", result["status"])

    @patch("services.liveconnect.balance.save_balance")
    @patch("services.liveconnect.balance.requests.get")
    @patch(
        "services.liveconnect.balance.build_headers",
        return_value={"PageGearToken": "token"},
    )
    def test_get_balance_persists_cached_balance(self, _mock_headers, mock_get, mock_save_balance):
        mock_get.return_value = MockResponse(200, {"data": {"idc": 17, "balance": 1234.5}})

        result = get_balance()

        self.assertTrue(result["ok"])
        self.assertEqual(17, result["idc"])
        self.assertEqual(1234.5, result["balance"])
        mock_save_balance.assert_called_once()

    @patch("services.liveconnect.channels.requests.get")
    @patch(
        "services.liveconnect.channels.build_headers",
        return_value={"PageGearToken": "token", "Accept": "application/json"},
    )
    def test_get_channels_returns_normalized_response(self, _mock_headers, mock_get):
        mock_get.return_value = MockResponse(200, {"items": [{"id": 1}]})

        result = get_channels({"visible": 1})

        self.assertTrue(result["ok"])
        self.assertEqual(200, result["status_code"])
        self.assertEqual([{"id": 1}], result["items"])

    @patch("services.liveconnect.webhook_config.requests.post")
    @patch(
        "services.liveconnect.webhook_config.build_headers",
        return_value={"PageGearToken": "token", "Content-Type": "application/json"},
    )
    def test_set_webhook_returns_normalized_response(self, _mock_headers, mock_post):
        mock_post.return_value = MockResponse(200, {"detail": "configured"})

        result = set_webhook({"id_canal": 753, "estado": True})

        self.assertTrue(result["ok"])
        self.assertEqual("configured", result["detail"])

    @patch("services.liveconnect.webhook_config.requests.post")
    @patch(
        "services.liveconnect.webhook_config.build_headers",
        return_value={"PageGearToken": "token", "Content-Type": "application/json"},
    )
    def test_get_webhook_returns_normalized_response(self, _mock_headers, mock_post):
        mock_post.return_value = MockResponse(200, {"estado": "activo"})

        result = get_webhook(753)

        self.assertTrue(result["ok"])
        self.assertEqual(200, result["status_code"])
        self.assertEqual("activo", result["estado"])


if __name__ == "__main__":
    unittest.main()
