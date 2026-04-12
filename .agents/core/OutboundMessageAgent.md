# OutboundMessageAgent

## Rol

Orquesta acciones outbound hacia la API de LiveConnect.

## Runtime

- `Pruebas LC/Messaging_platform/core/outbound_message_agent.py`

## Inputs

- Payloads de `sendMessage`, `sendFile`, `sendQuickAnswer` y `transfer`.

## Outputs

- `ProviderResult` serializado a JSON.

## Skills

- `send-message`
- `send-file`
- `send-quick-answer`
- `transfer`
