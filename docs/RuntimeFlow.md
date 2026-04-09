# RuntimeFlow.md — Flujos de Ejecución en Tiempo Real

## Visión General

Este documento describe paso a paso cómo el sistema procesa eventos reales. Incluye ejemplos concretos, timings, estados de Engram y respuestas esperadas.

---

## Escenario 1: Webhook Entrante (Mensaje de Usuario)

### Descripción
Usuario envía mensaje a través de WhatsApp → Proxy LiveConnect → webhook POST a nuestro sistema → procesar y almacenar

### Precondiciones
- Conversación `LCWAP|753|573178560023C` existe en Engram
- Token de validación no requerido (webhook es de proveedor confiable)
- Sistema en estado nominal

### Timeline Detallado

```
┌─────────────────────────────────────────────────────────────────┐
│ T+0ms: HTTP POST /webhook/liveconnect                           │
├─────────────────────────────────────────────────────────────────┤
│ Request Headers:                                                 │
│   Content-Type: application/json                                │
│   X-Request-ID: req-uuid-12345                                  │
│                                                                 │
│ Request Body:                                                   │
│ {                                                               │
│   "id_conversacion": "LCWAP|753|573178560023C",                │
│   "id_canal": 753,                                              │
│   "message": {                                                  │
│     "texto": "¿Cuál es tu horario de atención?",              │
│     "tipo": 1,                                                  │
│     "file": null                                                │
│   },                                                            │
│   "contact_data": {"name": "Brandon Gallego"},                 │
│   "timestamp": "2026-04-08T10:30:00Z"                          │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Paso 1: MessageRouter (T+2ms)

```python
# MessageRouter.execute()

print("[T+2ms] MessageRouter recibe webhook")

request = {
    'source': 'webhook',
    'endpoint': '/webhook/liveconnect',
    'payload': payload,
    'headers': headers,
    'request_id': 'req-uuid-12345'
}

# 1. Validación básica
if not is_json_valid(payload):
    return {
        'status': 400,
        'body': {'code': 'ERR_INVALID_JSON', 'message': 'JSON malformado'}
    }

# 2. Clasificación
if request['endpoint'] == '/webhook/liveconnect':
    classification = 'incoming_message'
    target_agent = 'WebhookProcessor'
elif request['endpoint'] == '/send_message':
    classification = 'outgoing_message'
    target_agent = 'SendMessageAgent'
else:
    classification = 'unknown'
    target_agent = 'ErrorHandler'

print(f"[T+2ms] Clasificación: {classification}")
print(f"[T+2ms] Target Agent: {target_agent}")

# 3. Respuesta provisional
response_provisional = {
    'status': 202,
    'body': {
        'status': 'received',
        'request_id': 'req-uuid-12345'
    }
}

# 4. Enrutar
enqueue_task(
    agent='WebhookProcessor',
    context={
        'classification': classification,
        'payload': payload,
        'request_id': request_id,
        'timestamp': now()
    }
)

print(f"[T+2ms] Enrrutado a {target_agent}, respuesta provisional enviada")
```

**Output**: HTTP 202 Accepted
```json
{
  "status": "received",
  "request_id": "req-uuid-12345"
}
```

---

### Paso 2: WebhookProcessor Comienza (T+5ms)

```python
# WebhookProcessor.execute()

print("[T+5ms] WebhookProcessor inicia ejecución")

context = get_context_from_queue()
payload = context['payload']
request_id = context['request_id']

# Skill 1: ParsePayload
print("[T+6ms] Invocando ParsePayload skill")

parse_result = invoke_skill('ParsePayload', {
    'raw_payload': json.dumps(payload),
    'payload_type': 'webhook',
    'schema_validation': 'lenient'
})

print(f"[T+7ms] ParsePayload retorna: {parse_result}")
```

**Estado en Engram**: STM [sin cambios aún]

---

### Paso 3: Validación (T+10ms)

```python
# Skill 2: ValidateMessage
print("[T+10ms] Invocando ValidateMessage skill")

validation_result = invoke_skill('ValidateMessage', {
    'message': parse_result['parsed']['message'],
    'message_type': parse_result['parsed']['message_type'],
    'constraints': {
        'min_length': 1,
        'max_length': 5000,
        'allow_html': False,
        'allow_urls': True
    }
})

print(f"[T+11ms] ValidateMessage retorna: {validation_result}")

if not validation_result['valid']:
    print(f"[T+12ms] Validación falló: {validation_result['violations']}")
    # Registrar error y retornar
    invoke_skill('LogEvent', {
        'event_type': 'webhook.validation_failed',
        'level': 'warning',
        'request_id': request_id,
        'metadata': {'violations': validation_result['violations']}
    })
    return  # abortarNormally
```

**Output**: validation_result
```json
{
  "valid": true,
  "message_sanitized": "¿Cuál es tu horario de atención?",
  "violations": [],
  "score": 0.98
}
```

---

### Paso 4: Query de Contexto (T+15ms)

```python
# Skill: RetrieveHistory (contexto de conversación)
print("[T+15ms] Consultando ConversationManager para contexto")

# Invocar ConversationManager
conversation_context = invoke_agent_method(
    agent='ConversationManager',
    method='get_context',
    params={
        'conversation_id': 'LCWAP|753|573178560023C'
    }
)

print(f"[T+16ms] ConversationManager retorna: {conversation_context}")
```

**Bajo el capó del ConversationManager**:

```python
# T+15ms
conversation_id = 'LCWAP|753|573178560023C'

# 1. Intenta STM lookup
stm_result = read_stm(f'conversation:{conversation_id}')

if stm_result is None:
    print(f"[T+15.1ms] STM miss")
    
    # 2. Fallback a LTM
    ltm_query = """
    SELECT id, channel_id, created_at, updated_at, status, participants, metadata
    FROM engram_conversations
    WHERE id = ?
    """
    ltm_result = db.query(ltm_query, [conversation_id]).fetchone()
    
    if ltm_result:
        print(f"[T+15.8ms] LTM hit")
        
        # 3. Cachear en STM
        conversation_data = {
            'id': ltm_result['id'],
            'channel_id': ltm_result['channel_id'],
            'status': ltm_result['status'],
            'created_at': ltm_result['created_at'],
            'last_updated': ltm_result['updated_at'],
            'participants': json.loads(ltm_result['participants'])
        }
        
        write_stm(f'conversation:{conversation_id}', conversation_data, ttl=30min)
        
        return conversation_data
    else:
        print(f"[T+16ms] LTM miss - conversación no existe")
        raise ConversationNotFoundError(conversation_id)

return stm_result
```

**Output**: conversation_context
```json
{
  "id": "LCWAP|753|573178560023C",
  "channel_id": 753,
  "status": "active",
  "created_at": "2026-04-05T09:00:00Z",
  "last_updated": "2026-04-08T10:25:00Z",
  "participants": ["Brandon Gallego"],
  "metadata": {
    "tipo_canal": "whatsapp",
    "tags": ["vip"]
  }
}
```

---

### Paso 5: Almacenar Mensaje (T+20ms)

```python
# Skill: StoreMessage
print("[T+20ms] Invocando StoreMessage skill")

message_insert = {
    'conversation_id': 'LCWAP|753|573178560023C',
    'sender': 'usuario',
    'message': '¿Cuál es tu horario de atención?',
    'message_type': 'text',
    'file_id': None,
    'metadata': {
        'contact_name': 'Brandon Gallego',
        'timestamp': '2026-04-08T10:30:00Z',
        'tipo_mensaje': 1
    }
}

store_result = invoke_skill('StoreMessage', message_insert)

print(f"[T+22ms] StoreMessage retorna: {store_result}")
```

**Bajo el capó de StoreMessage**:

```python
# T+20ms - Transacción a LTM
with db.transaction():
    # 1. Generar message_id
    message_id = generate_uuid()  # 'msg-abc123def456'
    
    # 2. INSERT en engram_messages
    db.insert('engram_messages', {
        'id': message_id,
        'conversation_id': 'LCWAP|753|573178560023C',
        'sender': 'usuario',
        'message_type': 'text',
        'message': '¿Cuál es tu horario de atención?',
        'file_id': None,
        'metadata': json.dumps({
            'contact_name': 'Brandon Gallego',
            'timestamp': '2026-04-08T10:30:00Z'
        }),
        'created_at': now()  # Server time, not client
    })
    
    print(f"[T+21ms] Mensaje insertado en LTM")
    
    # 3. UPDATE en engram_conversations
    db.execute("""
    UPDATE engram_conversations
    SET updated_at = ?, last_message_id = ?
    WHERE id = ?
    """, [now(), message_id, 'LCWAP|753|573178560023C'])
    
    print(f"[T+22ms] Conversación actualizada")

# 4. Actualizar STM (fuera de transacción para rapidez)
write_stm(
    f'conversation:LCWAP|753|573178560023C',
    {
        'last_message_id': message_id,
        'last_updated': now()
    },
    ttl=30min
)

print(f"[T+22.5ms] STM actualizado")

return {
    'success': True,
    'message_id': message_id,
    'stored_at': now()
}
```

**Output**: store_result
```json
{
  "success": true,
  "message_id": "msg-abc123def456",
  "stored_at": "2026-04-08T10:30:01Z"
}
```

**Estado de Engram después**:

STM:
```
Key: conversation:LCWAP|753|573178560023C
Value: {
  last_message_id: "msg-abc123def456",
  last_updated: "2026-04-08T10:30:01Z"
}
TTL: 30m
```

LTM:
```
engram_messages:
  id: "msg-abc123def456"
  conversation_id: "LCWAP|753|573178560023C"
  sender: "usuario"
  message: "¿Cuál es tu horario de atención?"
  created_at: "2026-04-08T10:30:01Z"
  
engram_conversations:
  updated_at: "2026-04-08T10:30:01Z"  ← actualizado
  last_message_id: "msg-abc123def456"
```

---

### Paso 6: Logging (T+24ms)

```python
# Skill: LogEvent
print("[T+24ms] Invocando LogEvent skill")

invoke_skill('LogEvent', {
    'event_type': 'webhook.received',
    'level': 'info',
    'request_id': 'req-uuid-12345',
    'user_id': None,  # webhook anónimo
    'metadata': {
        'conversation_id': 'LCWAP|753|573178560023C',
        'message_id': 'msg-abc123def456',
        'sender': 'usuario',
        'message_length': len('¿Cuál es tu horario de atención?')
    }
})

print(f"[T+25ms] Evento registrado en auditoría")
```

**Insert en LTM**:
```sql
INSERT INTO engram_audit_log (
  id, timestamp, event_type, level, request_id, 
  user_id, metadata
) VALUES (
  'log-uuid-xyz',
  '2026-04-08T10:30:02Z',
  'webhook.received',
  'info',
  'req-uuid-12345',
  NULL,
  '{...}'
);
```

---

### Paso 7: Emisión de Eventos (T+26ms)

```python
# WebhookProcessor emite evento
print("[T+26ms] Emitiendo evento: webhook.stored")

event_bus.emit('webhook.stored', {
    'conversation_id': 'LCWAP|753|573178560023C',
    'message_id': 'msg-abc123def456',
    'sender': 'usuario',
    'timestamp': now()
})

print("[T+26ms] Otros servicios pueden escuchar este evento:")
print("  - UI: refresh conversación")
print("  - Analytics: tracking")
print("  - Notification: notificar agente si aplica")
```

---

### Paso 8: Finalización (T+30ms)

```python
print("[T+30ms] WebhookProcessor completa")
print("[T+30ms] Mensaje almacenado exitosamente")
print("[T+30ms] Estado final:")
print(f"  - Message ID: msg-abc123def456")
print(f"  - Conversation updated_at: 2026-04-08T10:30:01Z")
print(f"  - Total latency: 30ms")
```

---

### Consumo de Recursos

| Recurso | Operación | Costo |
|---------|-----------|-------|
| **CPU** | JSON parse + validation | <1ms |
| **Memory** | Context + payload | ~50KB |
| **STM** | 1 read + 1 write | 2ms |
| **LTM** | 2 inserts + 1 update | 15ms |
| **I/O** | Disk fsync | ~5ms |

**Total**: ~30ms para procesamiento completo

---

## Escenario 2: Envío de Mensaje desde UI

### Descripción
Usuario agente en UI → click "Enviar" → HTTP POST /send_message → validar token → enviar a provider → guardar localmente

### Precondiciones
- Usuario autenticado con token válido
- Conversación activa
- Provider disponible

### Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ T+0ms: HTTP POST /send_message                                  │
├─────────────────────────────────────────────────────────────────┤
│ Request Headers:                                                 │
│   Authorization: Bearer eyJhbGciOi...                           │
│   Content-Type: application/json                                │
│                                                                 │
│ Request Body:                                                   │
│ {                                                               │
│   "conversation_id": "LCWAP|753|573178560023C",                │
│   "channel_id": 753,                                            │
│   "message": "¿Cuál es el estado de tu pedido?",               │
│   "type": "text"                                                │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Paso 1-2: MessageRouter + Clasificación (T+2ms)

MessageRouter clasifica como `outgoing_message`, target = `SendMessageAgent`

### Paso 3: Autenticación (T+5ms)

```python
# Skill: AuthenticateRequest
print("[T+5ms] Validando token")

token = 'eyJhbGciOi...'
token_hash = hash_token(token)

# 1. Intenta STM lookup
stm_token = read_stm(f'token:{token_hash}')

if stm_token:
    print(f"[T+5.5ms] STM hit - token válido en cache")
    auth_result = {
        'authenticated': True,
        'user_id': stm_token['user_id'],
        'session_id': stm_token['session_id'],
        'expires_at': stm_token['expires_at']
    }
else:
    print(f"[T+5.5ms] STM miss - buscar en LTM")
    
    # 2. Buscar en LTM
    ltm_token = db.query(
        "SELECT * FROM engram_tokens WHERE token_hash = ?",
        [token_hash]
    ).fetchone()
    
    if ltm_token and not is_expired(ltm_token['expires_at']):
        print(f"[T+6.5ms] LTM hit - token válido")
        
        # Cachear STM
        write_stm(f'token:{token_hash}', ltm_token, ttl=1h)
        
        auth_result = {
            'authenticated': True,
            'user_id': ltm_token['user_id'],
            'session_id': ltm_token['session_id'],
            'expires_at': ltm_token['expires_at']
        }
    else:
        print(f"[T+7ms] Token no válido o expirado")
        auth_result = {
            'authenticated': False,
            'reason': 'Invalid or expired token'
        }

print(f"[T+7ms] Auth result: {auth_result}")
```

**Output**: auth_result
```json
{
  "authenticated": true,
  "user_id": "agent-user-123",
  "session_id": "sess-456",
  "expires_at": "2026-04-08T18:00:00Z"
}
```

**Si falla**: HTTP 401 Unauthorized

```json
{
  "code": "ERR_UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

### Paso 4: Validación de Destino (T+10ms)

```python
# SendMessageAgent valida destino
print("[T+10ms] Validando conversación de destino")

conversation_id = 'LCWAP|753|573178560023C'

# Consultar ConversationManager para verificar acceso
can_send = invoke_agent_method(
    agent='ConversationManager',
    method='can_send_to',
    params={
        'user_id': 'agent-user-123',
        'conversation_id': conversation_id
    }
)

if not can_send:
    print(f"[T+11ms] Acceso denegado a conversación")
    return error_response(403, "Forbidden")

print(f"[T+12ms] Acceso permitido")
```

### Paso 5: Envío a Provider (T+15ms)

```python
# Skill: SendToProvider
print("[T+15ms] Enviando mensaje a provider")

provider_payload = {
    'id_conversacion': 'LCWAP|753|573178560023C',
    'mensaje': '¿Cuál es el estado de tu pedido?'
}

send_result = invoke_skill('SendToProvider', {
    'provider_endpoint': 'https://api.liveconnect.chat/prod/proxy/sendMessage',
    'provider_token': get_provider_token(),  # from TokenManager
    'conversation_id': 'LCWAP|753|573178560023C',
    'payload': provider_payload,
    'timeout_ms': 5000
})

print(f"[T+20ms] Provider response: {send_result}")
```

**Provider Response** (HTTP 200):
```json
{
  "status": "OK",
  "message_id": "provider-msg-ext-456",
  "timestamp": "2026-04-08T10:35:00Z"
}
```

**send_result**:
```json
{
  "success": true,
  "provider_response": {"status": "OK", ...},
  "provider_message_id": "provider-msg-ext-456",
  "http_status": 200,
  "latency_ms": 250
}
```

### Paso 6: Almacenar Localmente (T+22ms)

```python
# Skill: StoreMessage
print("[T+22ms] Guardando mensaje localmente")

store_result = invoke_skill('StoreMessage', {
    'conversation_id': 'LCWAP|753|573178560023C',
    'message': '¿Cuál es el estado de tu pedido?',
    'sender': 'agent',
    'message_type': 'text',
    'metadata': {
        'provider_message_id': 'provider-msg-ext-456',
        'sent_via': 'ui',
        'user_id': 'agent-user-123'
    }
})

print(f"[T+24ms] Mensaje guardado localmente")
print(f"[T+24ms] Message ID: {store_result['message_id']}")
```

### Paso 7: Respuesta al Cliente (T+26ms)

```python
print("[T+26ms] Respondiendo al cliente")

client_response = {
    'status': 202,
    'body': {
        'status': 'queued',
        'message_id': 'msg-local-uuid',
        'provider_message_id': 'provider-msg-ext-456'
    }
}

print(f"[T+26ms] Total latency: 26ms")
return client_response
```

**HTTP Response**:
```json
{
  "status": "queued",
  "message_id": "msg-local-uuid",
  "provider_message_id": "provider-msg-ext-456"
}
```

---

### Timeline Visual

```
T+0ms  ┌─ Request received
T+2ms  ├─ MessageRouter
T+5ms  ├─ AuthenticateRequest skill
T+10ms ├─ ConversationManager validation
T+15ms ├─ SendToProvider skill (HTTP call)
T+20ms ├─ Provider response
T+22ms ├─ StoreMessage skill (LTM insert)
T+26ms └─ Response to client
         Total: 26ms
```

---

## Escenario 3: Error handling y Retry

### Descripción
SendToProvider falla por timeout → ErrorHandler entra → retry con exponential backoff

### Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ T+0ms: SendToProvider (primera vez)                             │
├─────────────────────────────────────────────────────────────────┤
│ Endpoint: https://api.liveconnect.chat/prod/proxy/sendMessage  │
│ Timeout: 5000ms                                                 │
│ Response: TIMEOUT (Socket got no response after 5s)            │
└─────────────────────────────────────────────────────────────────┘
```

### Paso 1: Captura de Error (T+5005ms)

```python
# SendToProvider skill lanza excepción
try:
    response = requests.post(
        'https://api.liveconnect.chat/prod/proxy/sendMessage',
        json=payload,
        timeout=5
    )
except requests.Timeout:
    error = {
        'type': 'NetworkError',
        'message': 'Provider timeout after 5s',
        'retryable': True
    }
    
    # Invocar ErrorHandler
    error_action = invoke_agent(
        agent='ErrorHandler',
        context={
            'error': error,
            'source_agent': 'SendMessageAgent',
            'conversation_id': 'LCWAP|753|573178560023C'
        }
    )
    
    print(f"[T+5005ms] ErrorHandler decision: {error_action}")
```

### Paso 2: ErrorHandler Decision (T+5010ms)

```python
# ErrorHandler.execute()

error_type = 'NetworkError'
source_agent = 'SendMessageAgent'

# Consultar error counter
error_count = read_stm(f'errors:SendMessageAgent:NetworkError')['count']

if error_count < 5 and error_type == 'NetworkError':
    print(f"[T+5010ms] Decision: RETRY")
    print(f"[T+5010ms] Reason: Retryable error, attempt {error_count + 1}/5")
    
    # Calcular backoff: 2^attempt * 100ms {+ jitter
    backoff_ms = (2 ** error_count) * 100 + random(0, 100)
    
    print(f"[T+5010ms] Scheduling retry in {backoff_ms}ms")
    
    # Increment error counter
    increment_stm(
        f'errors:SendMessageAgent:NetworkError',
        ttl=5min
    )
    
    # Schedule retry
    schedule_task(
        agent='SendMessageAgent',
        context={...},
        delay_ms=backoff_ms
    )
    
    # Log evento
    invoke_skill('LogEvent', {
        'event_type': 'send.retry_scheduled',
        'level': 'warning',
        'metadata': {
            'conversation_id': 'LCWAP|753|573178560023C',
            'attempt': error_count + 1,
            'backoff_ms': backoff_ms
        }
    })
    
    return {
        'action': 'retry',
        'delay_ms': backoff_ms
    }
else:
    print(f"[T+5010ms] Decision: ESCALATE")
    print(f"[T+5010ms] Reason: Max retries exceeded or non-retryable error")
    
    invoke_skill('LogEvent', {
        'event_type': 'send.failed',
        'level': 'error',
        'metadata': {
            'conversation_id': 'LCWAP|753|573178560023C',
            'attempts': error_count,
            'reason': 'Max retries exceeded'
        }
    })
    
    return {
        'action': 'escalate',
        'notify_user': True
    }
```

### Paso 3: Exponential Backoff Timeline

```
Attempt 1: T+5010ms - TIMEOUT
            └─ ErrorHandler: retry scheduled
            
T+5010ms    Error count: 1
            Backoff: 2^1 * 100 = 200ms
            Scheduled retry at: T+5210ms

T+5210ms    Attempt 2 - RETRY
            └─ SendToProvider (reintentar)
            └─ Provider timeout again
            └─ ErrorHandler: retry scheduled

T+5215ms    Error count: 2
            Backoff: 2^2 * 100 = 400ms
            Scheduled retry at: T+5615ms

T+5615ms    Attempt 3 - RETRY
            └─ SendToProvider
            └─ SUCCESS: HTTP 200
            └─ StoreMessage (almacenar)

T+5620ms    Mensaje enviado exitosamente
            ErrorHandler clears error counter
```

### Paso 4: Success (T+5620ms)

```python
# SendToProvider retries
print(f"[T+5615ms] SendToProvider attempt 3")
print(f"[T+5618ms] Provider responds: HTTP 200 OK")

send_result = {
    'success': True,
    'provider_message_id': 'ext-789',
    'latency_ms': 3
}

# Limpiar error counter
delete_stm(f'errors:SendMessageAgent:NetworkError')

# Continuar con StoreMessage
store_result = invoke_skill('StoreMessage', {...})

print(f"[T+5620ms] Mensaje enviado y almacenado exitosamente")
```

### State de Engram en T+5620ms

**STM (antes)**:
```
Key: errors:SendMessageAgent:NetworkError
Value: {count: 3, window_start: T+5010ms, window_end: T+5310ms}
```

**STM (después)**:
```
Key: errors:SendMessageAgent:NetworkError
→ DELETED (limpieza)
```

**LTM (insert)**:
```
engram_messages:
  id: msg-final-123
  conversation_id: LCWAP|753|573178560023C
  message: "¿Cuál es el estado..."
  provider_message_id: ext-789
  attempts: 3  ← metadata de retry
  
engram_audit_log: (3 eventos)
  1. send.retry_scheduled (attempt 1)
  2. send.retry_scheduled (attempt 2)
  3. message.sent (attempt 3, success)
```

---

## Escenario 4: Rate Limiting en Acción

### Descripción
Usuario excede límite de mensajes por minuto → RateLimitCheck rechaza → ErrorHandler notifica

### Timeline

```
Usuario "agent-user-123" envía 6 mensajes en 60 segundos
Policy: máximo 5 mensajes por minuto
```

### Paso 1-5: Primeros 5 Mensajes (T+0s a T+50s) ✓

```
T+0s   → POST /send_message #1 → OK (count: 1/5)
T+10s  → POST /send_message #2 → OK (count: 2/5)
T+20s  → POST /send_message #3 → OK (count: 3/5)
T+30s  → POST /send_message #4 → OK (count: 4/5)
T+40s  → POST /send_message #5 → OK (count: 5/5)
```

STM:
```
Key: ratelimit:agent-user-123:sendmessage
Value: {
  count: 5,
  reset_at: T+60s,
  policy: per_minute
}
```

### Paso 6: Sexto Mensaje (T+50s) ✗

```python
# Skill: RateLimitCheck
print("[T+50s] RateLimitCheck verificar límite")

user_id = 'agent-user-123'
endpoint = 'sendmessage'

counter = read_stm(f'ratelimit:{user_id}:{endpoint}')

print(f"[T+50s] Counter: {counter}")
print(f"[T+50s] Current count: 5/5")

if counter['count'] >= 5:
    print(f"[T+50s] LIMITE EXCEDIDO")
    
    remaining = 60 - (now() - counter['window_start'])
    
    rate_limit_result = {
        'allowed': False,
        'remaining': 0,
        'reset_at': counter['reset_at'],
        'retry_after_seconds': remaining
    }
    
    invoke_skill('LogEvent', {
        'event_type': 'ratelimit.exceeded',
        'level': 'warning',
        'user_id': user_id,
        'metadata': {
            'endpoint': endpoint,
            'limit': 5,
            'reset_at': counter['reset_at']
        }
    })
    
    return error_response(429, {
        'code': 'ERR_RATE_LIMITED',
        'message': f'Rate limit exceeded. Retry after {remaining}s',
        'retry_after': remaining
    })
```

**HTTP Response**: 429 Too Many Requests
```json
{
  "code": "ERR_RATE_LIMITED",
  "message": "Rate limit exceeded. Retry after 10 seconds",
  "retry_after": 10
}
```

---

## Escenario 5: Deduplicación de Archivo

### Descripción
Webhook con archivo → detectar si ya existe por hash → reutilizar referencia

### Timeline

```
T+0ms: Webhook con archivo: "documento.pdf"
       Size: 2.5MB
       URL: https://storage.com/docs/documento123.pdf
```

### Paso 1: FileHandler Procesa (T+5ms)

```python
# Skill: ExtractFileMetadata
print("[T+5ms] Extrayendo metadata de archivo")

file_meta = invoke_skill('ExtractFileMetadata', {
    'file_object': {
        'url': 'https://storage.com/docs/documento123.pdf',
        'name': 'documento',
        'ext': 'pdf'
    },
    'allowed_extensions': ['pdf', 'docx', 'jpg'],
    'max_size_mb': 50
})

print(f"[T+7ms] File metadata: {file_meta}")
```

### Paso 2: Cálculo de Hash (T+10ms)

```python
# Baixar y calcular hash
file_content = download_file('https://storage.com/docs/documento123.pdf')
file_hash = sha256(file_content)

print(f"[T+15ms] File hash: {file_hash}")
print(f"[T+15ms] Hash: sha256=abc123def456xyz...")
```

### Paso 3: Deduplicación (T+20ms)

```python
# Skill: DetectDuplicate
print("[T+20ms] Comprobando duplicados")

duplicate_result = invoke_skill('DetectDuplicate', {
    'entity_type': 'file',
    'entity_hash': file_hash,
    'entity_id': None
})

print(f"[T+21ms] Duplicate result: {duplicate_result}")

if duplicate_result['is_duplicate']:
    print(f"[T+21ms] ARCHIVO DUPLICADO")
    print(f"[T+21ms] Existing file ID: {duplicate_result['existing_id']}")
    
    # Reutilizar existing_id en lugar de almacenar nuevo
    file_id = duplicate_result['existing_id']
    
    # Increment reference count
    db.execute(
        "UPDATE engram_files SET references = references + 1 WHERE id = ?",
        [file_id]
    )
    
    print(f"[T+22ms] Reference count incremented")
else:
    print(f"[T+21ms] ARCHIVO NUEVO")
    
    # Almacenar nuevo
    file_id = generate_uuid()
    
    db.insert('engram_files', {
        'id': file_id,
        'hash': file_hash,
        'original_url': 'https://storage.com/docs/documento123.pdf',
        'file_name': 'documento.pdf',
        'extension': 'pdf',
        'mime_type': 'application/pdf',
        'size_bytes': len(file_content),
        'references': 1
    })
    
    # Cachear en STM
    write_stm(f'filehash:{file_hash}', {
        'file_id': file_id,
        'stored_at': now()
    }, ttl=6h)
    
    print(f"[T+23ms] Nuevo archivo almacenado")
```

### Comparison

**Caso 1: Duplicate (sin realmacenar)**
```
Bytes saved: 2.5MB
Time saved: ~500ms (no download)
Result: {'is_duplicate': True, 'existing_id': 'file-xxx'}
```

**Caso 2: New File (persistencia normal)**
```
Bytes used: 2.5MB
Time used: ~500ms (download + hash)
Result: {'is_duplicate': False, 'file_id': 'file-yyy'}
```

---

## Escenario 6: Configuración de Webhook dinámico

### Descripción
Usuario configura URL de webhook desde UI → validar → guardar configuración

### Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ T+0ms: HTTP POST /config/setWebhook                             │
├─────────────────────────────────────────────────────────────────┤
│ Authorization: Bearer token                                     │
│ Body:                                                           │
│ {                                                               │
│   "id_canal": 753,                                              │
│   "url": "https://mi-webhook.com/liveconnect",                 │
│   "events": ["message.received", "message.sent"]               │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Paso 1-2: Auth + Route (T+2ms)

MessageRouter → ConfigurationAgent

### Paso 3: Validación (T+10ms)

```python
# ConfigurationAgent valida
print("[T+10ms] Validando configuración")

url = 'https://mi-webhook.com/liveconnect'
id_canal = 753

# Validar URL
if not is_valid_https_url(url):
    return error_response(400, "URL must be HTTPS")

# Validar canal existe
if not channel_exists(id_canal):
    return error_response(404, "Channel not found")

print(f"[T+15ms] Validación OK")
```

### Paso 4: Invocación de Provider (T+20ms)

```python
# Skill: SendToProvider
print("[T+20ms] Enviando configuración a provider")

provider_payload = {
    'id_canal': 753,
    'url': 'https://mi-webhook.com/liveconnect',
    'events': ['message.received', 'message.sent']
}

send_result = invoke_skill('SendToProvider', {
    'provider_endpoint': 'https://api.liveconnect.chat/prod/proxy/setWebhook',
    'provider_token': get_provider_token(),
    'payload': provider_payload,
    'timeout_ms': 5000
})

print(f"[T+25ms] Provider response: {send_result}")
```

### Paso 5: Persistencia Local (T+30ms)

```python
# Guardar configuración en Engram
print("[T+30ms] Guardando configuración en Engram")

config = {
    'id_canal': 753,
    'url': 'https://mi-webhook.com/liveconnect',
    'events': ['message.received', 'message.sent'],
    'set_by': 'user-123',
    'set_at': now(),
    'provider_response': send_result['provider_response']
}

# Guardar en LTM (config table)
db.upsert('engram_config', {
    'channel_id': 753,
    'type': 'webhook_url'
}, config)

# Cachear en STM
write_stm(f'config:webhook:753', config, ttl=24h)

print(f"[T+32ms] Configuración guardada")
```

### Paso 6: Respuesta (T+35ms)

```python
return {
    'status': 200,
    'body': {
        'status': 'ok',
        'message': 'Webhook configurado exitosamente',
        'url': url,
        'events': ['message.received', 'message.sent']
    }
}
```

---

## Resumen de Patrones de Timing

| Escenario | Latencia | Bottleneck | STM Hits | LTM Ops |
|-----------|----------|-----------|----------|---------|
| Webhook incoming | 30ms | Disk I/O | 0 | 2 inserts |
| Send message | 26ms | Provider | 1 read | 1 insert |
| Error + Retry | 5(1620ms | Network (provider up timeout) | 3 updates | 3 inserts |
| Rate limit | 2ms | Cache lookup | 1 read | 0 |
| File dedup | 25ms | File hash | 1 hit/write | 1 upsert |
| Config webhook | 35ms | Provider | 1 write | 1 upsert |

---

## Checklist de Monitoreo

Para validar que el sistema funciona correctamente, monitorear:

- [ ] P99 latency < 500ms (excepto network I/O)
- [ ] STM hit rate > 95%
- [ ] Error rate < 1%
- [ ] Retry success rate > 90%
- [ ] Rate limit rejections < 5%
- [ ] Audit log completeness: 100% de eventos críticos
- [ ] No corrupción de datos: validación de integridad referencial
- [ ] Consistencia STM-LTM: lag < 5 segundos

---

## Conclusión

Los flujos descriptos muestran cómo el sistema maneja:
- ✓ Entrada diversa (webhook, API, UI)
- ✓ Decisiones inteligentes (agentes)
- ✓ Ejecución atómica (skills)
- ✓ Recuperación ante fallos (ErrorHandler + retry)
- ✓ Performance (Engram dual-layer memory)
- ✓ Auditoría completa (logging)

Todos los flujos mantienen **integridad de datos**, **consistencia eventual** y **latencia predecible**.
