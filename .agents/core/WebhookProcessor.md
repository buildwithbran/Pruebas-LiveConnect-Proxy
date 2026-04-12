# WebhookProcessor

## Rol

Procesa webhooks entrantes de LiveConnect y persiste mensajes validos.

## Runtime

- `Pruebas LC/Messaging_platform/core/webhook_processor.py`

## Inputs

- Payload JSON del webhook.

## Outputs

- `{"status": "ok|ignored|error", "ok": boolean, "error|warning": "string"}`

## Skills

- `parse-payload`
- `validate-message`
- `store-message`
