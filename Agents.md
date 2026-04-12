# Agentes

- `MessageRouter`: clasifica la operacion HTTP y delega al orquestador correcto.
  Runtime: `Pruebas LC/Messaging_platform/core/message_router.py`
- `WebhookProcessor`: normaliza, valida y persiste mensajes entrantes.
  Runtime: `Pruebas LC/Messaging_platform/core/webhook_processor.py`
- `OutboundMessageAgent`: centraliza `sendMessage`, `sendFile`, `sendQuickAnswer` y `transfer`.
  Runtime: `Pruebas LC/Messaging_platform/core/outbound_message_agent.py`
- `ConfigurationAgent`: centraliza `setWebhook`, `getWebhook`, `balance` y `channels`.
  Runtime: `Pruebas LC/Messaging_platform/core/configuration_agent.py`

# Skills

- `parse-payload`: normaliza payloads webhook legados y del proveedor.
- `validate-message`: decide si el mensaje debe persistirse o ignorarse.
- `store-message`: guarda mensajes normalizados en SQLite.
- `send-message`: envia texto al proveedor y persiste el outbound localmente.
- `send-file`: envia archivo URL-based y persiste su representacion local.
- `send-quick-answer`: envia quick answers y guarda una representacion legible.
- `transfer`: transfiere conversaciones al proveedor.
- `set-webhook`: configura el webhook del canal.
- `get-webhook`: consulta configuracion actual del webhook.
- `get-balance`: consulta y cachea el balance del proxy.
- `get-channels`: lista canales disponibles para configuracion.

# Mapa de Capacidades

- `POST /webhook/liveconnect` -> `MessageRouter` -> `WebhookProcessor` -> [`parse-payload`, `validate-message`, `store-message`]
- `POST /sendMessage|/sendFile|/sendQuickAnswer|/transfer` -> `MessageRouter` -> `OutboundMessageAgent`
- `POST /setWebhook|/getWebhook`, `GET /balance`, `GET /config/channels` -> `MessageRouter` -> `ConfigurationAgent`
- `GET /conversations`, `GET /messages/<conversation_id>` permanecen como lecturas directas de inbox/repository.

# Referencias

- `/.agents/docs/Architecture.md`
- `/.agents/docs/SkillsIndex.md`
- `/.agents/Skills/skill-proxy-lc/SKILL.md`
- `Pruebas LC/Messaging_platform/tests/`
