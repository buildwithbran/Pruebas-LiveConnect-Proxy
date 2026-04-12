# MessageRouter

## Rol

Clasifica la operacion HTTP y devuelve el comando interno que debe ejecutarse.

## Runtime

- `Pruebas LC/Messaging_platform/core/message_router.py`

## Inputs

- Nombre de ruta interna, por ejemplo `webhook.receive` o `config.balance`.
- Payload JSON o query params ya normalizados por Flask.

## Outputs

- `RouteCommand` con `name` y `handler`.

## Usa

- `WebhookProcessor`
- `OutboundMessageAgent`
- `ConfigurationAgent`
