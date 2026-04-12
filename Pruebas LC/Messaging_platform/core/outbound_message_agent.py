from services.liveconnect.send_file import send_file
from services.liveconnect.send_message import send_message
from services.liveconnect.send_quick_answer import send_quick_answer
from services.liveconnect.transfer import transfer


class OutboundMessageAgent:
    def send_message(self, payload):
        return send_message(payload)

    def send_quick_answer(self, payload):
        return send_quick_answer(payload)

    def send_file(self, payload):
        return send_file(payload)

    def transfer(self, payload):
        return transfer(payload)
