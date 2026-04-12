from DB.database import default_repository
from core.webhook_processor import WebhookProcessor


def process_incoming_webhook(data, repository=default_repository):
    processor = WebhookProcessor(repository=repository)
    return processor.process(data)
