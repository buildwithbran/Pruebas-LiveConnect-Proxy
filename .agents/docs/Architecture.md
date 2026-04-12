# Architecture — LiveConnect Proxy v1

## Resumen

La arquitectura AI-first separa tres capas:

- `Agents.md`: indice de entrada para Codex.
- `.agents/`: contexto minimo, skills y fichas de agentes.
- `Pruebas LC/Messaging_platform/`: runtime Python que expone HTTP, orquesta flujos y persiste datos.

## Runtime

- `core/message_router.py`: resuelve la operacion interna desde la ruta HTTP.
- `core/webhook_processor.py`: pipeline `parse_payload -> validate_message -> store_message`.
- `core/outbound_message_agent.py`: agrupa envio de mensajes, archivos, quick answers y transferencias.
- `core/configuration_agent.py`: agrupa webhook config, balance y canales.
- `services/liveconnect/`: adaptadores atómicos contra la API de LiveConnect.
- `services/webhook/`: normalizacion y persistencia de mensajes entrantes.
- `DB/` e `Inbox/`: infraestructura existente de almacenamiento y lectura.

## Flujos clave

- Webhook:
  `POST /webhook/liveconnect` -> `MessageRouter` -> `WebhookProcessor` -> SQLite
- Outbound:
  `POST /sendMessage|/sendFile|/sendQuickAnswer|/transfer` -> `MessageRouter` -> `OutboundMessageAgent` -> LiveConnect API
- Config:
  `POST /setWebhook|/getWebhook`, `GET /balance`, `GET /config/channels` -> `MessageRouter` -> `ConfigurationAgent`

## Principios

- `App.py` no contiene logica de negocio.
- Los agentes orquestan; los servicios ejecutan.
- Los skills AI documentan contratos y capacidades, no implementacion Python.
- Las rutas alias mantienen compatibilidad y comparten el mismo handler interno.
