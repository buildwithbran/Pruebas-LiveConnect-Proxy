from core.configuration_agent import ConfigurationAgent
from core.contracts import RouteCommand
from core.outbound_message_agent import OutboundMessageAgent
from core.webhook_processor import WebhookProcessor


class MessageRouter:
    def __init__(self):
        self._webhook_processor = WebhookProcessor()
        self._outbound_agent = OutboundMessageAgent()
        self._configuration_agent = ConfigurationAgent()
        self._commands = {
            "webhook.receive": RouteCommand(
                name="webhook.receive",
                handler=self._webhook_processor.process,
            ),
            "message.send": RouteCommand(
                name="message.send",
                handler=self._outbound_agent.send_message,
            ),
            "message.send_quick_answer": RouteCommand(
                name="message.send_quick_answer",
                handler=self._outbound_agent.send_quick_answer,
            ),
            "message.send_file": RouteCommand(
                name="message.send_file",
                handler=self._outbound_agent.send_file,
            ),
            "conversation.transfer": RouteCommand(
                name="conversation.transfer",
                handler=self._outbound_agent.transfer,
            ),
            "config.set_webhook": RouteCommand(
                name="config.set_webhook",
                handler=self._configuration_agent.set_webhook,
            ),
            "config.get_webhook": RouteCommand(
                name="config.get_webhook",
                handler=self._configuration_agent.get_webhook,
            ),
            "config.balance": RouteCommand(
                name="config.balance",
                handler=self._configuration_agent.get_balance,
            ),
            "config.channels": RouteCommand(
                name="config.channels",
                handler=self._configuration_agent.get_channels,
            ),
        }

    def command_for(self, route_name):
        try:
            return self._commands[route_name]
        except KeyError as error:
            raise ValueError(f"Ruta interna no soportada: {route_name}") from error
