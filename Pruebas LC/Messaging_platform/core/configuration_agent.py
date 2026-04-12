from services.liveconnect.balance import get_balance
from services.liveconnect.channels import get_channels
from services.liveconnect.webhook_config import get_webhook, set_webhook


class ConfigurationAgent:
    def set_webhook(self, payload):
        return set_webhook(payload or {})

    def get_webhook(self, payload):
        payload = payload or {}
        id_canal = payload.get("id_canal")
        if id_canal is None:
            return {"ok": False, "status_code": 400, "error": "id_canal es requerido"}
        return get_webhook(id_canal)

    def get_balance(self, _payload=None):
        return get_balance()

    def get_channels(self, filters=None):
        return get_channels(filters or {})
