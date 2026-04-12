import unittest
from unittest.mock import patch

from App import app


class RouteAliasTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    @patch("core.configuration_agent.set_webhook")
    def test_set_webhook_aliases_share_same_contract(self, mock_set_webhook):
        mock_set_webhook.return_value = {"ok": True, "status_code": 207, "detail": "configured"}

        config_response = self.client.post("/config/setWebhook", json={"id_canal": 753})
        root_response = self.client.post("/setWebhook", json={"id_canal": 753})

        self.assertEqual(config_response.status_code, root_response.status_code)
        self.assertEqual(config_response.get_json(), root_response.get_json())

    @patch("core.configuration_agent.get_webhook")
    def test_get_webhook_aliases_share_same_contract(self, mock_get_webhook):
        mock_get_webhook.return_value = {"ok": True, "status_code": 200, "estado": "activo"}

        config_response = self.client.post("/config/getWebhook", json={"id_canal": 753})
        root_response = self.client.post("/getWebhook", json={"id_canal": 753})

        self.assertEqual(config_response.status_code, root_response.status_code)
        self.assertEqual(config_response.get_json(), root_response.get_json())

    @patch("core.configuration_agent.get_balance")
    def test_balance_aliases_share_same_contract(self, mock_get_balance):
        mock_get_balance.return_value = {"ok": True, "status_code": 200, "balance": 99.5}

        config_response = self.client.get("/config/balance")
        root_response = self.client.get("/balance")

        self.assertEqual(config_response.status_code, root_response.status_code)
        self.assertEqual(config_response.get_json(), root_response.get_json())


if __name__ == "__main__":
    unittest.main()
