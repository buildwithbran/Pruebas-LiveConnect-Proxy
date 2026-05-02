# Deep Wiki - Pruebas-LiveConnect-Proxy

## Resumen ejecutivo
`Pruebas LC/Messaging_platform` es un backend Flask que funciona como proxy hacia LiveConnect, expone una inbox web para operar conversaciones y persiste datos operativos en SQLite. La arquitectura actual usa un router interno de comandos, agentes por dominio y skills de integración con LiveConnect.

## Estructura del repositorio

- `Pruebas LC/Messaging_platform/App.py`
  Punto de entrada Flask y definición de rutas HTTP.
- `Pruebas LC/Messaging_platform/core/`
  Agentes principales y contratos compartidos.
- `Pruebas LC/Messaging_platform/services/`
  Skills de webhook, LiveConnect y realtime SSE.
- `Pruebas LC/Messaging_platform/services/webhook_service.py`
  Wrapper de compatibilidad que delega al `WebhookProcessor`.
- `Pruebas LC/Messaging_platform/DB/database.py`
  Repositorio SQLite, esquema y helpers de persistencia.
- `Pruebas LC/Messaging_platform/Inbox/`
  Lecturas de conversaciones y mensajes.
- `Pruebas LC/Messaging_platform/templates/index.html`
  UI principal de inbox.
- `Pruebas LC/Messaging_platform/static/main.js`
  Lógica frontend, sincronización SSE y acciones UI.
- `Pruebas LC/Messaging_platform/static/main.css`
  Estilos y temas visuales.
- `Pruebas LC/Messaging_platform/tests/`
  Tests unitarios para rutas, webhook, repo y servicios.

## Arquitectura actual

El backend organiza el flujo mediante `MessageRouter`, que delega a tres agentes:

- `WebhookProcessor`: procesa webhooks entrantes.
- `OutboundMessageAgent`: maneja operaciones salientes.
- `ConfigurationAgent`: maneja configuración de webhook, balance y canales.

### Comandos internos del router

- `webhook.receive`
- `message.send`
- `message.send_quick_answer`
- `message.send_file`
- `conversation.transfer`
- `config.set_webhook`
- `config.get_webhook`
- `config.balance`
- `config.channels`

## Flujo de webhooks

El webhook entra por `POST /webhook/liveconnect` y sigue este pipeline:

```text
request JSON
-> MessageRouter
-> WebhookProcessor
-> parse_payload
-> validate_message
-> store_message
-> SQLiteRepository.save_message()
-> publish("message.updated")
-> SSE /events/stream
```

### Reglas del pipeline

- `parse_payload()` normaliza payloads planos y payloads anidados del proveedor.
- `validate_message()` rechaza payloads sin `id_conversacion`.
- Los mensajes vacíos se marcan como ignorados solo si no traen contenido ni contexto suficiente.
- `store_message()` intenta reconciliar la conversación por `celular` o `contact_name` antes de persistir.
- Al guardar un mensaje se publica el evento SSE `message.updated`.
- `services/webhook_service.process_incoming_webhook()` existe como wrapper para llamadas más antiguas o tests.

## Flujo saliente

Las operaciones salientes pasan por el router y luego por el agente correspondiente:

- `POST /sendMessage` -> `OutboundMessageAgent.send_message()`
- `POST /sendQuickAnswer` -> `OutboundMessageAgent.send_quick_answer()`
- `POST /sendFile` -> `OutboundMessageAgent.send_file()`
- `POST /transfer` -> `OutboundMessageAgent.transfer()`

Cada skill:

- obtiene token con `token_provider.build_headers()`
- llama a la API `https://api.liveconnect.chat`
- normaliza la respuesta
- registra localmente el mensaje cuando aplica

## Rutas HTTP actuales

### UI

- `GET /`
  Renderiza `templates/index.html`.

### Inbox y lectura directa

- `GET /conversations`
  Lista conversaciones desde SQLite.
- `GET /messages/<conversation_id>`
  Lista mensajes paginados de una conversación.

### Configuración

- `POST /setWebhook`
- `POST /config/setWebhook`
- `POST /getWebhook`
- `POST /config/getWebhook`
- `GET /balance`
- `GET /config/balance`
- `GET /config/channels`

### Operaciones de conversación

- `POST /sendMessage`
- `POST /sendQuickAnswer`
- `POST /sendFile`
- `POST /transfer`

### Webhook y realtime

- `POST /webhook/liveconnect`
- `GET /events/stream`

### Endpoints auxiliares

- `GET /users/list`
- `GET /groups/list`
- `POST /conversation/archive`
- `POST /conversation/read`
- `POST /proxy/sendMessage`
- `POST /proxy/sendQuickAnswer`
- `POST /proxy/sendFile`
- `POST /proxy/transfer`

## Alias y compatibilidad

`App.py` mantiene aliases públicos y de compatibilidad:

- `/config/setWebhook` y `/setWebhook` ejecutan el mismo comando interno.
- `/config/getWebhook` y `/getWebhook` ejecutan el mismo comando interno.
- `/config/balance` y `/balance` ejecutan el mismo comando interno.
- `/proxy/*` delega al mismo conjunto de comandos que las rutas directas de envío.

Los tests `test_route_aliases.py` validan que los aliases expongan el mismo contrato.

## Persistencia SQLite

La base vive en `Pruebas LC/Messaging_platform/database.db` y se inicializa al importar `App.py` mediante `init_db()`.

### Tablas reales

#### `conversations`

- `id` `TEXT PRIMARY KEY`
- `canal` `TEXT`
- `contact_name` `TEXT`
- `celular` `TEXT`
- `archived` `INTEGER DEFAULT 0`
- `last_message_at` `DATETIME DEFAULT CURRENT_TIMESTAMP`
- `last_message_from` `TEXT DEFAULT 'client'`
- `unread_count` `INTEGER DEFAULT 0`
- `last_agent_response_at` `DATETIME`
- `updated_at` `DATETIME DEFAULT CURRENT_TIMESTAMP`

#### `messages`

- `id` `INTEGER PRIMARY KEY AUTOINCREMENT`
- `conversation_id` `TEXT`
- `sender` `TEXT`
- `message` `TEXT`
- `message_type` `TEXT DEFAULT 'text'`
- `file_url` `TEXT`
- `file_name` `TEXT`
- `file_ext` `TEXT`
- `metadata` `TEXT`
- `created_at` `DATETIME DEFAULT CURRENT_TIMESTAMP`

#### `system_config`

- `key` `TEXT PRIMARY KEY`
- `value` `TEXT`

### Comportamiento del repositorio

- `save_message()` normaliza texto, canal, tipo de mensaje, adjuntos y metadata.
- Una conversación se actualiza por `id` con `ON CONFLICT`.
- `unread_count` aumenta para mensajes de cliente y se reinicia para mensajes de agente.
- `last_agent_response_at` se actualiza cuando el sender es `agent`.
- `last_message_from` queda normalizado como `client`, `agent` o `system`.
- `save_balance()` cachea el saldo en `system_config`.
- `get_messages()` devuelve paginación con `cursor`, `next_cursor` y `has_more`.

## Skills de LiveConnect

### Webhook

- `parse-payload`
- `validate-message`
- `store-message`

### Outbound

- `send-message`
- `send-file`
- `send-quick-answer`
- `transfer`

### Configuración

- `set-webhook`
- `get-webhook`
- `get-balance`
- `get-channels`

### Soporte

- `token_provider`
- `response_normalizer`
- `users`
- `realtime`

## Integración con LiveConnect

### Token

`services/liveconnect/token_provider.py` obtiene `PageGearToken` usando `LIVECONNECT_KEY` y `LIVECONNECT_SECRET`. El token se cachea hasta casi su expiración.

### Endpoints remotos usados

- `POST /prod/account/token`
- `POST /prod/proxy/sendMessage`
- `POST /prod/proxy/sendFile`
- `POST /prod/proxy/sendQuickAnswer`
- `POST /prod/proxy/transfer`
- `POST /prod/proxy/setWebhook`
- `POST /prod/proxy/getWebhook`
- `GET /prod/proxy/balance`
- `GET /prod/channels/list`
- `GET /prod/users/list`
- `GET /prod/groups/list`

### Normalización de respuestas

`normalize_json_response()` considera exitosa una respuesta HTTP 200 con payload vacío o con `status == 1`.

## Realtime SSE

`services/realtime.py` implementa un pub/sub en memoria para SSE.

### Comportamiento

- `subscribe()` registra un consumidor con cola acotada.
- `publish()` difunde eventos a todos los suscriptores.
- `format_sse()` serializa eventos con `event:` y `data:`.
- `GET /events/stream` emite `retry: 2000`, luego `stream.ready` al conectar y `stream.heartbeat` cuando no hay eventos.
- La conexión se limpia con `unsubscribe()` al cerrar el stream.
- El frontend usa reconexión automática y refresco manual.

## Frontend

La interfaz principal vive en `templates/index.html` y `static/main.js`.

### Estado actual visible

- Sidebar con estado SSE.
- Lista de conversaciones.
- Panel de chat.
- Configuración de webhook y balance.
- Composer para mensajes, quick answers y archivos.
- Acciones de conversación: archivar, marcar leído y transferir.
- Botón manual de refresco para sincronización inmediata.

### Integraciones frontend

- `GET /conversations`
- `GET /messages/<conversation_id>`
- `GET /events/stream`
- `POST /sendMessage`
- `POST /sendQuickAnswer`
- `POST /sendFile`
- `POST /transfer`
- `POST /config/setWebhook`
- `POST /config/getWebhook`
- `GET /balance`
- `GET /config/channels`
- `POST /conversation/archive`
- `POST /conversation/read`
- `GET /users/list`
- `GET /groups/list`

### Estado del tema

- En el código actual solo está disponible el tema `dark`.
- `THEMES` contiene un único valor.
- El selector de temas y los swatches quedan reducidos a una sola opción.

## Servicios auxiliares

- `Inbox/conversations.py` delega en el repositorio para listar conversaciones.
- `Inbox/messages.py` normaliza el formato de mensajes antes de devolverlo al frontend.
- `services/liveconnect/users.py` consulta usuarios y grupos remotos con filtros opcionales.
- `services/liveconnect/balance.py` obtiene el saldo y lo cachea localmente.
- `services/liveconnect/channels.py` consulta los canales visibles del proveedor.

## Inconsistencias críticas detectadas

- El wiki anterior mencionaba una arquitectura con múltiples temas visuales y un selector con seis opciones; el frontend actual solo registra `dark`.
- El wiki anterior decía que `WebhookProcessor` publicaba SSE tras persistir, lo cual es correcto, pero omitía que el evento concreto es `message.updated`.
- El wiki anterior no documentaba rutas reales presentes en `App.py`, como `/users/list`, `/groups/list`, `/conversation/archive`, `/conversation/read` y los aliases `/proxy/*`.
- El wiki anterior describía un esquema SQLite más simple; la implementación actual incluye `contact_name`, `celular`, `archived`, `last_message_at`, `last_message_from`, `unread_count`, `last_agent_response_at` y `system_config`.
- El wiki anterior no reflejaba que `GET /messages/<conversation_id>` usa paginación con cursor.
- El wiki anterior no reflejaba que `ConfigurationAgent.get_webhook()` requiere `id_canal`.
- El wiki anterior no dejaba claro que `services/webhook_service.py` es solo un wrapper de compatibilidad, no el pipeline principal.

## Archivos relevantes

- `Pruebas LC/Messaging_platform/App.py`
- `Pruebas LC/Messaging_platform/core/message_router.py`
- `Pruebas LC/Messaging_platform/core/webhook_processor.py`
- `Pruebas LC/Messaging_platform/core/outbound_message_agent.py`
- `Pruebas LC/Messaging_platform/core/configuration_agent.py`
- `Pruebas LC/Messaging_platform/services/webhook/parse_payload.py`
- `Pruebas LC/Messaging_platform/services/webhook/validate_message.py`
- `Pruebas LC/Messaging_platform/services/webhook/store_message.py`
- `Pruebas LC/Messaging_platform/services/liveconnect/*.py`
- `Pruebas LC/Messaging_platform/DB/database.py`
- `Pruebas LC/Messaging_platform/Inbox/*.py`
- `Pruebas LC/Messaging_platform/static/main.js`
- `Pruebas LC/Messaging_platform/templates/index.html`
- `Pruebas LC/Messaging_platform/tests/*.py`
