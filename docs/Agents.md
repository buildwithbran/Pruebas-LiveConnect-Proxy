# Agents.md — Definición de Agentes Multi-Agente con Engram

## Visión General

Los agentes son entidades autónomas especializadas que toman decisiones, orquestan skills, consultan memoria y se comunican entre sí. Cada agente tiene un propósito acotado (Single Responsibility Principle) y acceso a tipos específicos de memoria.

---

## 1. MessageRouter Agent

### Nombre
**MessageRouter** (Orquestador de Mensajes)

### Propósito
Determinar el destino y tipo de procesamiento de mensajes entrantes/salientes. Actúa como dispatcher central que clasifica, valida y enruta a agentes especializados.

### Responsabilidades
- Clasificar tipo de mensaje (texto, archivo, webhook, API request, etc.)
- Validar estructura básica y permisos
- Decidir si el mensaje es entrante o saliente
- Enrutar a agente especializado
- Mantener auditoría de enrutamiento

### Contexto de Uso
- **Trigger**: Cualquier entrada nueva al sistema (webhook POST, HTTP request)
- **Cuándo se activa**: Siempre que hay nuevo evento
- **Prioridad**: Alta (primer filtro del sistema)

### Inputs
```json
{
  "source": "webhook|api|ui",
  "payload": {},
  "headers": {},
  "timestamp": "ISO8601",
  "request_id": "uuid"
}
```

### Outputs
```json
{
  "classification": "incoming_message|outgoing_message|config_change|error",
  "target_agent": "WebhookProcessor|SendMessageAgent|ConfigurationAgent|ErrorHandler",
  "context": {
    "conversation_id": "string",
    "channel_id": "int",
    "priority": "low|normal|high|critical"
  },
  "proceed": true|false,
  "reason": "string"
}
```

### Reglas de Decisión

```
IF source == "webhook" AND has_conversation_id
  THEN target_agent = "WebhookProcessor"
  
IF source == "api" AND route == "/send_message" AND valid_token
  THEN target_agent = "SendMessageAgent"
  
IF source == "api" AND route == "/webhook/config" AND valid_token
  THEN target_agent = "ConfigurationAgent"
  
IF payload invalid OR token missing/expired
  THEN target_agent = "ErrorHandler"
  REASON = "Validation failed" OR "Authentication required"
```

### Integración con Memoria

| Aspecto | Tipo | Operación | Detalles |
|---------|------|-----------|----------|
| **Lee** | Short-term | lookup | Rate limits, sesión token en cache |
| **Lee** | Long-term | search | Historial de conversación (quick lookup) |
| **Escribe** | Short-term | log | Evento de enrutamiento con timestamp |
| **Escribe** | Long-term | append | Registro de auditoría (cada N eventos) |

### Relación con Otros Agentes

- **Orquesta a**: WebhookProcessor, SendMessageAgent, ConfigurationAgent, ErrorHandler
- **Recibe handoff de**: ErrorHandler (reintentos)
- **Consulta**: TokenManager (validación rápida)

### Triggers
- `event.webhook.incoming`
- `event.api.request`
- `event.ui.action`
- `event.system.retry`

### Ejemplo de Flujo de Ejecución

```
1. Webhook llega /webhook/liveconnect
2. MessageRouter clasifica: "incoming_message"
3. Extrae conversation_id → "LCWAP|753|573178560023C"
4. Consulta memoria: ¿conversación existe?
5. Si existe → priority = "normal"
6. Si nueva → priority = "normal"
7. Enruta a WebhookProcessor
8. Registra evento: {timestamp, source, target, conversation_id}
9. Responde al cliente con acceptance provisional
```

---

## 2. WebhookProcessor Agent

### Nombre
**WebhookProcessor** (Procesador de Webhooks Entrantes)

### Propósito
Procesar eventos entrantes desde el proveedor (e.g., LiveConnect Proxy), validar payloads, extraer metadatos y orquestar persistencia.

### Responsabilidades
- Validar firma/estructura del webhook
- Parsear payload (texto, archivo, contacto, metadata)
- Enriquecer con contexto (detectar si es respuesta a mensaje anterior)
- Invocar skill de almacenamiento
- Registrar en auditoria
- Notificar a agentes interesados (e.g., ConversationManager)

### Contexto de Uso
- **Trigger**: MessageRouter envía `classification == "incoming_message"`
- **Endpoint**: POST /webhook/liveconnect
- **Garantía**: Exactamente una persistencia por webhook (idempotencia)

### Inputs
```json
{
  "id_conversacion": "string",
  "id_canal": "int",
  "message": {
    "texto": "string",
    "tipo": "int",
    "file": { "url": "string", "name": "string", "ext": "string" }
  },
  "contact_data": { "name": "string", "phone": "string" },
  "metadata": { "timestamp": "ISO8601", "source": "string" }
}
```

### Outputs
```json
{
  "status": "received|queued|stored|error",
  "message_id": "uuid",
  "conversation_id": "string",
  "events_emitted": [
    "webhook.received",
    "message.stored",
    "conversation.updated"
  ]
}
```

### Reglas de Decisión

```
IF NOT id_conversacion
  THEN status = "error"
  REASON = "Missing required field: id_conversacion"
  
IF message.texto == "" AND message.file == null
  THEN status = "ignored"
  REASON = "Empty message, no attachments"
  
IF message.file exists
  THEN invoke_skill("extract_file_metadata")
  
IF message.texto exists
  THEN invoke_skill("validate_message_content")
  
IF validation successful
  THEN invoke_skill("store_message")
```

### Integración con Memoria

| Aspecto | Tipo | Operación | Detalles |
|---------|------|-----------|----------|
| **Lee** | Short-term | lookup | ID de conversación en cache (evitar duplicados) |
| **Lee** | Long-term | search | Última entrada de conversación (contexto) |
| **Escribe** | Short-term | cache | Conversation ID con timestamp (5 min TTL) |
| **Escribe** | Long-term | insert | Mensaje nuevo + metadata |
| **Escribe** | Long-term | update | Conversation last_updated_at |

### Relación con Otros Agentes

- **Recibe de**: MessageRouter
- **Invoca**: FileHandler (si hay archivo), ConversationManager (notificación)
- **Consulta**: ConversationManager (estado actual) para contexto

### Triggers
- `webhook.received`
- `message.parsed.done`
- `storage.write.complete`

### Ejemplo de Flujo de Ejecución

```
1. MessageRouter enruta webhook a WebhookProcessor
2. Valida id_conversacion: ✓
3. Parsea payload: texto="Hola", file=null
4. Consulta memoria: ¿conversación LCWAP|753|573178560023C existe?
   → Sí, última actualización hace 2 horas
5. Extrae contacto: name = "Brandon Gallego"
6. Invoca skill "store_message":
   - conversation_id = "LCWAP|753|573178560023C"
   - message = "Hola"
   - sender = "usuario"
   - timestamp = now()
7. Skill retorna message_id = "uuid-abc123"
8. Actualiza Engram: conversation.last_updated_at = now()
9. Emite evento: webhook.stored
10. Responde {status: "stored", message_id: "uuid-abc123"}
```

---

## 3. SendMessageAgent

### Nombre
**SendMessageAgent** (Agente de Envío de Mensajes)

### Propósito
Gestionar el envío de mensajes salientes hacia el proveedor, validar destino, enriquecer contexto y registrar estado.

### Responsabilidades
- Validar token de usuario
- Validar destino (conversation_id, channel_id)
- Buscar conversación en memoria
- Invocar skill de envío al proveedor
- Registrar localmente la intención de envío
- Manejar reintentos en caso de fallo
- Notificar ConversationManager

### Contexto de Uso
- **Trigger**: MessageRouter envía `classification == "outgoing_message"`
- **Endpoint**: POST /send_message
- **Garantía**: Transactional (todo o nada)

### Inputs
```json
{
  "conversation_id": "string",
  "channel_id": "int",
  "message": "string",
  "type": "text|quick_answer",
  "metadata": { "quick_answer_id": "int", "variables": {} }
}
```

### Outputs
```json
{
  "status": "queued|sent|failed|retry",
  "message_id": "uuid",
  "provider_response": {},
  "events_emitted": [
    "message.queued",
    "message.sent_to_provider"
  ]
}
```

### Reglas de Decisión

```
IF NOT token_valid OR token_expired
  THEN status = "failed"
  REASON = "Authentication required"
  
IF NOT conversation_exists
  THEN status = "failed"
  REASON = "Conversation not found"
  
IF message.length > MAX_LENGTH
  THEN truncate OR error based on policy
  
IF send_to_provider SUCCESSFUL
  THEN status = "sent"
  STORE locally with sender="agent"
  
IF send_to_provider FAILED AND retries < MAX_RETRIES
  THEN status = "retry"
  schedule_retry with exponential backoff
```

### Integración con Memoria

| Aspecto | Tipo | Operación | Detalles |
|---------|------|-----------|----------|
| **Lee** | Short-term | lookup | Token de usuario, rate limits |
| **Lee** | Long-term | search | Conversation metadata, channel config |
| **Escribe** | Short-term | log | Intento de envío (transient) |
| **Escribe** | Long-term | insert | Mensaje con sender="agent" + status |
| **Escribe** | Long-term | update | Conversation state |

### Relación con Otros Agentes

- **Recibe de**: MessageRouter
- **Consulta**: TokenManager (validación), ConversationManager (contexto)
- **Notifica**: ErrorHandler (en caso de fallo), ConversationManager (actualización)

### Triggers
- `send_message.requested`
- `token.validated`
- `provider.response.received`

### Ejemplo de Flujo de Ejecución

```
1. MessageRouter enruta POST /send_message a SendMessageAgent
2. Valida token: ✓ (consulta TokenManager)
3. Busca conversation en Engram: LCWAP|753|573178560023C
   → Encontrada, channel_id=753
4. Valida mensaje: length=50, dentro de límites
5. Invoca skill "send_to_provider":
   - Construye payload para LiveConnect
   - Envía HTTP POST a API
6. Provider responde: {status: "OK", message_id_provider: "ext-123"}
7. Registra localmente:
   - message_id = "uuid-def456"
   - sender = "agent"
   - status = "sent"
   - provider_message_id = "ext-123"
8. Actualiza Engram: conversation.last_sent_at = now()
9. Emite: message.sent_to_provider
10. Responde al cliente: {status: "queued", message_id: "uuid-def456"}
```

---

## 4. ConversationManager Agent

### Nombre
**ConversationManager** (Agente de Gestión de Conversaciones)

### Propósito
Mantener el estado de conversaciones, historial, metadatos y decisiones sobre estado de sesión y relevancia.

### Responsabilidades
- Crear nuevas conversaciones
- Actualizar estado de conversación (activa, archivada, cerrada)
- Mantener metadata (participantes, canales, tags)
- Detectar patrones (e.g., conversación duplicada, reactivación)
- Emitir eventos de cambio de estado
- Proveer contexto a otros agentes

### Contexto de Uso
- **Trigger**: WebhookProcessor, SendMessageAgent request context
- **Consulta frecuente**: Sí
- **Actualización frecuente**: Sí

### Inputs
```json
{
  "action": "create|update|archive|close|query",
  "conversation_id": "string",
  "metadata": {
    "channel_id": "int",
    "participants": ["string"],
    "tags": ["string"],
    "status": "active|paused|archived|closed"
  }
}
```

### Outputs
```json
{
  "conversation": {
    "id": "string",
    "created_at": "ISO8601",
    "last_updated_at": "ISO8601",
    "status": "active|paused|archived|closed",
    "metadata": {}
  },
  "events_emitted": ["conversation.created", "conversation.status_changed"]
}
```

### Reglas de Decisión

```
IF action == "create" AND conversation_id NOT in Engram
  THEN create_new_conversation
  initial_status = "active"
  
IF action == "update" AND last_message_within 24h
  THEN status = "active"
  
IF action == "query"
  THEN return conversation + metadata + last_N_messages
  
IF inactivity > 30 days
  THEN suggest archive (not automatic)
```

### Integración con Memoria

| Aspecto | Tipo | Operación | Detalles |
|---------|------|-----------|----------|
| **Lee** | Short-term | lookup | Estado de conversación activa (cache) |
| **Lee** | Long-term | search | Historial completo, metadata |
| **Escribe** | Short-term | cache | Conversation state (10 min TTL) |
| **Escribe** | Long-term | insert | Nueva conversación |
| **Escribe** | Long-term | update | Timestamp, status, tags |

### Relación con Otros Agentes

- **Proveedor de contexto**: WebhookProcessor, SendMessageAgent, FileHandler
- **Notificado por**: WebhookProcessor, SendMessageAgent (cambios de estado)
- **Consulta**: ContextAnalyzer (para enriquecimiento de metadata)

### Triggers
- `conversation.new_message`
- `conversation.status_requested`
- `conversation.archive_request`

### Ejemplo de Flujo de Ejecución

```
1. WebhookProcessor consult ConversationManager:
   "Dame contexto de LCWAP|753|573178560023C"
2. ConversationManager busca en Engram:
   - Existe: created_at=2026-04-05, last_updated=2026-04-08
   - status = "active", participants = ["Brandon Gallego"]
3. Retorna metadata completa
4. WebhookProcessor actualiza timestamp: last_updated_at = now()
5. ConversationManager emite: conversation.updated
6. Retorna a WebhookProcessor el contexto enriquecido
```

---

## 5. TokenManager Agent

### Nombre
**TokenManager** (Agente de Gestión de Tokens)

### Propósito
Generar, validar y cachear tokens de autenticación. Proporciona garantías de seguridad y control de acceso.

### Responsabilidades
- Generar tokens de sesión
- Validar tokens antes de operaciones sensibles
- Cachear tokens válidos (con TTL)
- Detectar tokens expirados o revocados
- Manejar refresh tokens
- Auditar acceso

### Contexto de Uso
- **Trigger**: MessageRouter valida headers, SendMessageAgent requiere token
- **Consulta frecuente**: Muy alta
- **Latencia crítica**: Sí (debe ser muy rápido)

### Inputs
```json
{
  "action": "generate|validate|revoke|refresh",
  "credentials": { "user_id": "string", "api_key": "string" },
  "token": "string"
}
```

### Outputs
```json
{
  "valid": true|false,
  "token": "string",
  "expires_at": "ISO8601",
  "user_id": "string",
  "reason": "string"
}
```

### Reglas de Decisión

```
IF action == "validate" AND token in Engram cache
  THEN check expiry
  IF NOT expired RETURN valid, user_id
  
IF action == "validate" AND token NOT in cache
  THEN query long-term memory
  verify signature
  update cache
  
IF token_expired AND has_refresh_token
  THEN generate_new_token
  
IF multiple_failed_attempts (> 5 in 1h)
  THEN flag_suspicious_activity
  notify ErrorHandler
```

### Integración con Memoria

| Aspecto | Tipo | Operación | Detalles |
|---------|------|-----------|----------|
| **Lee** | Short-term | lookup | Token cache con TTL 1h |
| **Lee** | Long-term | search | User session, token history |
| **Escribe** | Short-term | cache | Token con expiry |
| **Escribe** | Long-term | log | Evento de validación (auditoría) |
| **Escribe** | Long-term | flag | Actividades sospechosas |

### Relación con Otros Agentes

- **Consultado por**: MessageRouter (validación inicial), SendMessageAgent, ConfigurationAgent
- **Notifica**: ErrorHandler (auth failures)

### Triggers
- `auth.token.validate`
- `auth.token.expired`
- `auth.suspicious_activity`

### Ejemplo de Flujo de Ejecución

```
1. MessageRouter recibe request con Authorization header
2. Consulta TokenManager: "Valida este token"
3. TokenManager busca en cache corto plazo:
   - Hit: Token válido, expiry in 55 min
   - Retorna: {valid: true, user_id: "user-123"}
4. MessageRouter procede
5. Si MISS en cache:
   - Busca en Engram (long-term)
   - Verifica firma
   - Actualiza cache
   - Retorna valid=true|false
```

---

## 6. FileHandler Agent

### Nombre
**FileHandler** (Agente de Manejo de Archivos)

### Propósito
Gestionar ciclo de vida de archivos: validación, almacenamiento, referenciación y limpieza.

### Responsabilidades
- Validar extensión y tamaño de archivo
- Generar URL de referencia o ID de archivo
- Registrar metadata del archivo
- Gestionar almacenamiento temporal
- Limpiar archivos obsoletos
- Prevenir duplicados

### Contexto de Uso
- **Trigger**: WebhookProcessor o SendMessageAgent detectan archivo
- **Eventos de archivo**: entrada, salida, ambos

### Inputs
```json
{
  "action": "ingest|reference|cleanup",
  "file": {
    "url": "string",
    "name": "string",
    "extension": "string",
    "size": "int",
    "source": "webhook|upload"
  }
}
```

### Outputs
```json
{
  "status": "stored|referenced|cleaned",
  "file_id": "uuid",
  "file_url": "string",
  "metadata": {
    "hash": "string",
    "size": "int",
    "stored_at": "ISO8601"
  }
}
```

### Reglas de Decisión

```
IF file.extension NOT in ALLOWED_EXTENSIONS
  THEN status = "rejected"
  REASON = "Extension not allowed"
  
IF file.size > MAX_FILE_SIZE
  THEN status = "rejected"
  REASON = "File too large"
  
IF file.source == "webhook"
  THEN reference external URL (no copy)
  
IF file.source == "upload"
  THEN store locally OR cloud
  generate checksum
  
IF file_hash in Engram (duplicate)
  THEN reuse existing_file_id
  avoid duplicate storage
```

### Integración con Memoria

| Aspecto | Tipo | Operación | Detalles |
|---------|------|-----------|----------|
| **Lee** | Short-term | lookup | Hash cache (evitar duplicados) |
| **Lee** | Long-term | search | File metadata, references |
| **Escribe** | Short-term | cache | File hash + ID (6h TTL) |
| **Escribe** | Long-term | insert | File record con metadata |
| **Escribe** | Long-term | log | Evento de ingesta/limpieza |

### Relación con Otros Agentes

- **Consultado por**: WebhookProcessor, SendMessageAgent
- **Notifica**: ConversationManager (archivo vinculado a conversación)

### Triggers
- `file.received`
- `file.sent`
- `file.cleanup.scheduled`

### Ejemplo de Flujo de Ejecución

```
1. WebhookProcessor detecta file: {url:"https://...", name:"doc.pdf", ext:"pdf"}
2. Enruta a FileHandler
3. Valida extensión: ✓ pdf en whitelist
4. Calcula hash: sha256=abc123def456
5. Busca en Engram: ¿hash abc123def456 existe?
   - No, archivo nuevo
6. Registra: file_id="uuid-file-1", hash=abc123def456, size=2.5MB
7. Enriquece mensaje con file_id
8. Retorna: {status: "referenced", file_id: "uuid-file-1"}
9. WebhookProcessor procede a guardar mensaje con referencia
```

---

## 7. ErrorHandler Agent

### Nombre
**ErrorHandler** (Agente de Manejo de Errores)

### Propósito
Capturar, clasificar, registrar y coordinar recuperación de errores de forma inteligente. Prevenir corrupción de datos y cascadas de fallos.

### Responsabilidades
- Capturar excepciones de cualquier agente o skill
- Clasificar severidad (low, normal, high, critical)
- Decidir acción (retry, escalate, ignore, notify)
- Registrar en auditoria y observabilidad
- Emitir alertas si es necesario
- Implementar circuit breaker si aplica

### Contexto de Uso
- **Trigger**: Cualquier error del sistema
- **Invocado por**: catch blocks, explicit error reports

### Inputs
```json
{
  "error": {
    "type": "ValueError|NetworkError|DatabaseError|AuthError",
    "message": "string",
    "stacktrace": "string",
    "source_agent": "string",
    "context": {}
  }
}
```

### Outputs
```json
{
  "action": "retry|escalate|notify|ignore|circuit_break",
  "retry_policy": { "max_attempts": "int", "backoff": "exponential|linear" },
  "notification": { "level": "info|warning|critical", "channels": [] }
}
```

### Reglas de Decisión

```
IF error_type == "NetworkError"
  THEN action = "retry"
  backoff = exponential, max_attempts = 5
  
IF error_type == "DatabaseError" AND severity == "critical"
  THEN action = "circuit_break"
  notify_ops_team
  
IF error_type == "AuthError"
  THEN action = "escalate"
  notify user
  
IF error_count_in_5min > THRESHOLD
  THEN circuit_break
  enter degraded mode
```

### Integración con Memoria

| Aspecto | Tipo | Operación | Detalles |
|---------|------|-----------|----------|
| **Lee** | Short-term | lookup | Contador de errores recientes (5 min window) |
| **Lee** | Long-term | search | Historial de errores, patrones |
| **Escribe** | Short-term | increment | Error counter (TTL 5 min) |
| **Escribe** | Long-term | log | Complete error record + context |
| **Escribe** | Short-term | flag | Circuit breaker state |

### Relación con Otros Agentes

- **Notificado por**: Cualquier agente en error
- **Consulta**: MessageRouter (reintentar operación)
- **Afecta**: Todos los agentes (puede cambiar estado del sistema)

### Triggers
- `error.caught`
- `error.classified`
- `circuit_breaker.triggered`

### Ejemplo de Flujo de Ejecución

```
1. SendMessageAgent intenta enviar a provider
2. Network timeout → exception
3. Llama ErrorHandler: {error: NetworkError, source: "SendMessageAgent"}
4. ErrorHandler clasifica: severity=normal, type=transient
5. Consulta Engram: contador de intentos en últimos 5min = 2
6. Decide: action="retry", backoff=exponential, attempt max=5
7. Registra error en Engram (auditoría)
8. Schedule retry en 2 segundos
9. Retorna al MessageRouter indicando "retry scheduled"
10. MessageRouter emite evento: message.retry_scheduled
```

---

## 8. ConfigurationAgent

### Nombre
**ConfigurationAgent** (Agente de Configuración)

### Propósito
Gestionar aspectos de configuración del sistema: webhooks, canales, límites y políticas. Permitir cambios en runtime.

### Responsabilidades
- Validar cambios de configuración
- Aplicar nuevas políticas
- Registrar cambios (auditoría)
- Notificar agentes afectados
- Prevenir configuraciones inválidas

### Contexto de Uso
- **Trigger**: MessageRouter enruta `classification == "config_change"`
- **Endpoints**: /config/*, /webhook/config

### Inputs
```json
{
  "action": "set|get|update|delete",
  "config_type": "webhook|channel|rate_limit|policy",
  "channel_id": "int",
  "value": {}
}
```

### Outputs
```json
{
  "status": "applied|validated|error",
  "config": {},
  "events_emitted": ["config.updated"]
}
```

### Integración con Memoria

| Aspecto | Tipo | Operación | Detalles |
|---------|------|-----------|----------|
| **Lee** | Short-term | lookup | Config en cache |
| **Lee** | Long-term | search | Config histórico, versiones |
| **Escribe** | Short-term | cache | Config actual |
| **Escribe** | Long-term | update | Nuevo valor con versión |

---

## Matriz de Comunicación Entre Agentes

```
                 MessageRouter  WebhookProcessor  SendMessageAgent  ConversationManager  TokenManager  FileHandler  ErrorHandler  ConfigurationAgent
MessageRouter         —             ✓ enruta          ✓ enruta          ✓ valida           ✓ valida        —              —                —
WebhookProcessor    ✓ responde       —               ✓ notifica         ✓ actualiza        ✓ auditoría    ✓ procesa       ✓ reporte        —
SendMessageAgent    ✓ responde       —                  —                ✓ actualiza        ✓ valida        ✓ procesa       ✓ reporte        —
ConversationManager ✓ consulta     ✓ consulta        ✓ consulta            —               —              —              —                —
TokenManager        ✓ valida        ✓ auditoría       ✓ auditoría        —                  —              —              —                —
FileHandler           —            ✓ procesa         ✓ procesa          ✓ notifica         —              —              —                —
ErrorHandler        ✓ reintentos   ✓ notificado      ✓ notificado       —                 —              —              —                —
ConfigurationAgent    —              —                 —                ✓ afecta config    —              —              —                —
```

---

## Patrones de Handoff

### Patrón 1: Enrutamiento Inicial
```
Input → MessageRouter → (clasificar) → Target Agent
```

### Patrón 2: Consulta de Contexto
```
Agent A → (requiere contexto) → ConversationManager → return metadata
```

### Patrón 3: Validación en Cascada
```
Agent A → TokenManager (token?) → MessageRouter (classification?) → Proceed
```

### Patrón 4: Manejo de Errores
```
Agent A → error → ErrorHandler → (decide) → Retry/Escalate/Notify
```

### Patrón 5: Actualización de Estado
```
Agent A → (completa operación) → ConversationManager (update state) → Event emission
```

---

## Resumen de Campos de Decisión Clave

Cada agente mantiene criterios claros de decisión basados en:

1. **Validación**: ¿Payload está bien formado?
2. **Autorización**: ¿Tiene permisos?
3. **Contexto**: ¿Información relevante existe?
4. **Consistencia**: ¿Operación es segura?
5. **Prioridad**: ¿Qué tan urgente?
6. **Rollback**: ¿Se puede revertir?

Todos estos criterios se consultan desde Engram (memoria persistente).
