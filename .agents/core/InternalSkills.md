# Skills.md — Habilidades Funcionales Desacopladas

## Visión General

Las skills son funciones atómicas, reutilizables y stateless (o con estado controlado) que ejecutan operaciones específicas. Pueden ser invocadas por múltiples agentes sin dependencias circulares. Cada skill tiene contrato, validaciones y manejo de errores explícito.

---

## Categorías de Skills

1. **Functional Skills**: ejecutan lógica pura (no tienen efectos secundarios persistentes)
2. **Memory-Read Skills**: leen del sistema de memoria
3. **Memory-Write Skills**: escriben a memoria
4. **Hybrid Skills**: combinan ejecución funcional con I/O

---

## 1. ParsePayload Skill

### Nombre
**ParsePayload**

### Descripción
Parsear JSON de entrada y normalizar estructura. Detectar tipo de mensaje (texto, archivo, config).

### Tipo
Functional

### Inputs
```json
{
  "raw_payload": "string (JSON)",
  "payload_type": "webhook|api|ui",
  "schema_validation": "strict|lenient"
}
```

### Outputs
```json
{
  "success": true|false,
  "parsed": {
    "conversation_id": "string",
    "channel_id": "int",
    "message_type": "text|file|quick_answer|config",
    "message": "string",
    "metadata": {}
  },
  "errors": ["error1", "error2"]
}
```

### Reglas de Ejecución

```
1. Intentar parse JSON, capturar JSONDecodeError
2. IF schema_validation == "strict"
   - Validar contra schema predefinido
   - Rechazar si no cumple
3. ELSE (lenient)
   - Aceptar cualquier estructura
   - Rellenar campos faltantes con defaults
4. Normalizar tipos:
   - channel_id: string → int
   - timestamp: various formats → ISO8601
5. Detectar message_type basado en campos presentes
```

### Casos de Uso

- Validación inicial de webhook
- Parse de form-data (API)
- Normalización de UI inputs

### Ejemplo Práctico

**Input:**
```json
{
  "raw_payload": "{\"id_conversacion\":\"LCWAP|753|123\",\"message\":{\"texto\":\"Hola\"}}",
  "payload_type": "webhook",
  "schema_validation": "lenient"
}
```

**Output:**
```json
{
  "success": true,
  "parsed": {
    "conversation_id": "LCWAP|753|123",
    "channel_id": 753,
    "message_type": "text",
    "message": "Hola",
    "metadata": {}
  },
  "errors": []
}
```

### Dependencias
Ninguna (pura)

---

## 2. ValidateMessage Skill

### Nombre
**ValidateMessage**

### Descripción
Validar contenido, longitud, caracteres especiales y conformidad con reglas de negocio.

### Tipo
Functional

### Inputs
```json
{
  "message": "string",
  "message_type": "text|quick_answer|command",
  "constraints": {
    "min_length": "int",
    "max_length": "int",
    "allow_html": "boolean",
    "allow_urls": "boolean"
  }
}
```

### Outputs
```json
{
  "valid": true|false,
  "message_sanitized": "string",
  "violations": ["violation1", "violation2"],
  "score": "float (0-1)"
}
```

### Reglas de Ejecución

```
1. Verificar longitud: length >= min_length AND <= max_length
2. Detectar caracteres inválidos (especiales, control, etc.)
3. IF allow_html == false: detectar y rechazar tags
4. IF allow_urls == false: detectar y rechazar URLs
5. Verificar ratio de spam (palabras repetidas, símbolos)
6. Truncar o rechazar según policies
7. Calcular "score" de calidad
```

### Casos de Uso

- Validación de mensaje previo a envío
- Prevención de inyección
- Filtrado de spam
- Validación de quick answers dinámicos

### Ejemplo Práctico

**Input:**
```json
{
  "message": "Hola, ¿cómo estás?",
  "message_type": "text",
  "constraints": {
    "min_length": 1,
    "max_length": 1000,
    "allow_html": false,
    "allow_urls": true
  }
}
```

**Output:**
```json
{
  "valid": true,
  "message_sanitized": "Hola, ¿cómo estás?",
  "violations": [],
  "score": 0.95
}
```

### Dependencias
Ninguna (pura)

---

## 3. ExtractFileMetadata Skill

### Nombre
**ExtractFileMetadata**

### Descripción
Parsear información de archivo: URL, nombre, extensión, tipo MIME, tamaño.

### Tipo
Functional

### Inputs
```json
{
  "file_object": {
    "url": "string",
    "name": "string",
    "ext": "string"
  },
  "allowed_extensions": ["pdf", "jpg", "png"],
  "max_size_mb": "int"
}
```

### Outputs
```json
{
  "valid": true|false,
  "metadata": {
    "file_name": "string",
    "extension": "string",
    "mime_type": "string",
    "size_mb": "float",
    "file_id": "uuid"
  },
  "errors": ["error1"]
}
```

### Reglas de Ejecución

```
1. Validar URL formato (http/https)
2. Extraer extension del URL O del campo "ext"
3. IF extension NOT in allowed_extensions
   THEN valid = false, append error
4. Detectar MIME type desde extension
5. Validar tamaño (si disponible)
6. Generar file_id único
```

### Casos de Uso

- Ingesta de archivos en webhook
- Validación de upload de usuario
- Preparación para referenciación

### Ejemplo Práctico

**Input:**
```json
{
  "file_object": {
    "url": "https://storage.com/documento.pdf",
    "name": "documento",
    "ext": "pdf"
  },
  "allowed_extensions": ["pdf", "docx", "jpg"],
  "max_size_mb": 50
}
```

**Output:**
```json
{
  "valid": true,
  "metadata": {
    "file_name": "documento.pdf",
    "extension": "pdf",
    "mime_type": "application/pdf",
    "size_mb": 2.5,
    "file_id": "uuid-file-1"
  },
  "errors": []
}
```

### Dependencias
Ninguna (pura)

---

## 4. AuthenticateRequest Skill

### Nombre
**AuthenticateRequest**

### Descripción
Validar token, extender sesión si es necesario, retornar user context.

### Tipo
Memory-Read (híbrido)

### Inputs
```json
{
  "token": "string",
  "request_id": "uuid",
  "ip_address": "string"
}
```

### Outputs
```json
{
  "authenticated": true|false,
  "user_id": "string",
  "session_id": "string",
  "expires_at": "ISO8601",
  "reason": "string"
}
```

### Reglas de Ejecución

```
1. Buscar token en Engram (short-term cache)
   IF found AND not expired
   RETURN authenticated=true
   
2. IF not in cache
   Consultar long-term memory
   Verify token signature
   Update cache
   
3. IF expired
   IF refresh_token exists
   Generate new token
   ELSE
   Return authenticated=false
   
4. Log acceso para auditoría
```

### Casos de Uso

- Validación inicial de requests
- Extensión de sesión
- Prevención de token replay
- Auditoría de acceso

### Ejemplo Práctico

**Input:**
```json
{
  "token": "eyJhbGciOi...",
  "request_id": "req-uuid-123",
  "ip_address": "192.168.1.100"
}
```

**Output:**
```json
{
  "authenticated": true,
  "user_id": "user-123",
  "session_id": "sess-456",
  "expires_at": "2026-04-08T15:30:00Z",
  "reason": "Token valid"
}
```

### Dependencias
- Engram (lectura short/long-term memory)

---

## 5. StoreMessage Skill

### Nombre
**StoreMessage**

### Descripción
Persistir mensaje en Engram con todas sus propiedades: contenido, metadata, timestamp, sender, estado.

### Tipo
Memory-Write (híbrido)

### Inputs
```json
{
  "conversation_id": "string",
  "message": "string",
  "sender": "usuario|agent|system",
  "message_type": "text|file|quick_answer",
  "metadata": {
    "file_id": "uuid",
    "contact_name": "string",
    "timestamp": "ISO8601"
  }
}
```

### Outputs
```json
{
  "success": true|false,
  "message_id": "uuid",
  "stored_at": "ISO8601",
  "reason": "string"
}
```

### Reglas de Ejecución

```
1. Validar conversation_id: NOT empty
2. Validar message: NOT empty OR file_id provided
3. Generar message_id único
4. Registrar timestamp (server time, no client)
5. Insertar en Engram long-term
6. Actualizar conversation.last_updated_at
7. Registrar evento: message.stored
8. Return success=true, message_id
```

### Casos de Uso

- Guardar mensajes de webhook
- Guardar mensajes enviados por agente
- Auditoría de comunicación
- Historial para análisis

### Ejemplo Práctico

**Input:**
```json
{
  "conversation_id": "LCWAP|753|123",
  "message": "Hola, ¿cómo puedo ayudarte?",
  "sender": "agent",
  "message_type": "text",
  "metadata": {
    "contact_name": "Brandon Gallego",
    "timestamp": "2026-04-08T12:00:00Z"
  }
}
```

**Output:**
```json
{
  "success": true,
  "message_id": "msg-uuid-789",
  "stored_at": "2026-04-08T12:00:01Z",
  "reason": "Message persisted successfully"
}
```

### Dependencias
- Engram (escritura long-term)
- Transaction control (rollback capability)

---

## 6. RetrieveHistory Skill

### Nombre
**RetrieveHistory**

### Descripción
Obtener historial de conversación con filtros opcionales: rango de fechas, tipo de mensaje, sender.

### Tipo
Memory-Read

### Inputs
```json
{
  "conversation_id": "string",
  "filters": {
    "start_date": "ISO8601",
    "end_date": "ISO8601",
    "message_type": "text|file|*",
    "sender": "usuario|agent|*",
    "limit": "int (default 50)"
  }
}
```

### Outputs
```json
{
  "success": true|false,
  "messages": [
    {
      "message_id": "uuid",
      "message": "string",
      "sender": "string",
      "message_type": "string",
      "timestamp": "ISO8601",
      "metadata": {}
    }
  ],
  "count": "int",
  "has_more": "boolean"
}
```

### Reglas de Ejecución

```
1. Validar conversation_id
2. Consultar Engram long-term
3. Aplicar filtros en orden: time range → message_type → sender
4. Limitar resultado a N mensajes
5. Retornar has_more si hay más resultados
6. Ordenar por timestamp ASC
```

### Casos de Uso

- UI de Inbox (mostrar historial)
- ContextAnalyzer (enriquecimiento)
- Búsqueda y auditoría
- Recuperación de contexto para agentes

### Ejemplo Práctico

**Input:**
```json
{
  "conversation_id": "LCWAP|753|123",
  "filters": {
    "start_date": "2026-04-01T00:00:00Z",
    "end_date": "2026-04-08T23:59:59Z",
    "message_type": "*",
    "sender": "*",
    "limit": 20
  }
}
```

**Output:**
```json
{
  "success": true,
  "messages": [
    {
      "message_id": "msg-123",
      "message": "Hola",
      "sender": "usuario",
      "message_type": "text",
      "timestamp": "2026-04-08T10:00:00Z",
      "metadata": {}
    }
  ],
  "count": 1,
  "has_more": false
}
```

### Dependencias
- Engram (lectura long-term)

---

## 7. SendToProvider Skill

### Nombre
**SendToProvider**

### Descripción
Enviar mensaje/archivo al proveedor externo (LiveConnect API) con retry logic.

### Tipo
Functional (+ I/O externo)

### Inputs
```json
{
  "provider_endpoint": "string (URL)",
  "provider_token": "string",
  "conversation_id": "string",
  "payload": {},
  "timeout_ms": "int"
}
```

### Outputs
```json
{
  "success": true|false,
  "provider_response": {},
  "provider_message_id": "string",
  "http_status": "int",
  "latency_ms": "int"
}
```

### Reglas de Ejecución

```
1. Validar provider_endpoint URL
2. Validar provider_token existe
3. Construir headers: Authorization, Content-Type
4. HTTP POST con timeout
5. Si 2xx: success=true, parse response
6. Si 4xx: success=false, don't retry (client error)
7. Si 5xx: success=false, allow retry (server error)
8. Si timeout: success=false, allow retry
9. Medir latency_ms
```

### Casos de Uso

- Envío de mensajes
- Envío de archivos
- Consultas de configuración
- Obtención de balance/channels

### Ejemplo Práctico

**Input:**
```json
{
  "provider_endpoint": "https://api.liveconnect.chat/prod/proxy/sendMessage",
  "provider_token": "PageGearToken_abc123",
  "conversation_id": "LCWAP|753|123",
  "payload": {
    "id_conversacion": "LCWAP|753|123",
    "mensaje": "Hola desde el agente"
  },
  "timeout_ms": 5000
}
```

**Output:**
```json
{
  "success": true,
  "provider_response": {
    "status": "OK",
    "message_id": "ext-msg-456"
  },
  "provider_message_id": "ext-msg-456",
  "http_status": 200,
  "latency_ms": 250
}
```

### Dependencias
- HTTP client (requests lib, etc.)
- Token válido (de TokenManager)

---

## 8. GenerateToken Skill

### Nombre
**GenerateToken**

### Descripción
Generar nuevo token con expiry, firma y metadata.

### Tipo
Functional (+ I/O)

### Inputs
```json
{
  "user_id": "string",
  "api_key": "string",
  "expires_in_hours": "int (default 8)"
}
```

### Outputs
```json
{
  "token": "string (JWT)",
  "expires_at": "ISO8601",
  "token_type": "Bearer"
}
```

### Reglas de Ejecución

```
1. Validar user_id y api_key
2. Generar JWT payload: {user_id, iat, exp}
3. Firmar con secret key
4. Calcular expiry: now + expires_in_hours
5. Retornar token, expires_at, type
```

### Casos de Uso

- Primer login
- Refresh de token expirado
- Testing/desarrollo

### Dependencias
- JWT library
- Secret key (from config)

---

## 9. LogEvent Skill

### Nombre
**LogEvent**

### Descripción
Registrar evento en sistema de auditoría con contexto, nivel de severidad y metadata.

### Tipo
Memory-Write

### Inputs
```json
{
  "event_type": "string (e.g., 'message.received', 'auth.failed')",
  "level": "debug|info|warning|error|critical",
  "request_id": "uuid",
  "user_id": "string",
  "metadata": {}
}
```

### Outputs
```json
{
  "logged": true,
  "log_id": "uuid",
  "timestamp": "ISO8601"
}
```

### Reglas de Ejecución

```
1. Generar log_id único
2. Registrar timestamp (server time)
3. Enriquecer con: IP, user_id, request_id
4. Serializar metadata a JSON
5. Escribir en Engram (long-term, append-only log)
6. SI level == "critical" → emit alert
```

### Casos de Uso

- Auditoría completa de sistema
- Debugging y troubleshooting
- Compliance y regulatorios
- Análisis de patrones

### Ejemplo Práctico

**Input:**
```json
{
  "event_type": "message.received",
  "level": "info",
  "request_id": "req-uuid-123",
  "user_id": "user-456",
  "metadata": {
    "conversation_id": "LCWAP|753|123",
    "message_length": 50
  }
}
```

**Output:**
```json
{
  "logged": true,
  "log_id": "log-uuid-789",
  "timestamp": "2026-04-08T12:00:01Z"
}
```

### Dependencias
- Engram (escritura long-term log)

---

## 10. QueryMemory Skill

### Nombre
**QueryMemory**

### Descripción
Búsqueda flexible en Engram: por ID, tags, metadata, texto completo.

### Tipo
Memory-Read

### Inputs
```json
{
  "query_type": "by_id|by_tag|by_metadata|full_text",
  "query": "string",
  "filters": {},
  "limit": "int"
}
```

### Outputs
```json
{
  "results": [
    {
      "id": "string",
      "type": "conversation|message|config|event",
      "data": {},
      "relevance_score": "float (0-1)"
    }
  ],
  "count": "int"
}
```

### Reglas de Ejecución

```
IF query_type == "by_id"
  → búsqueda directa, O(1)
  
IF query_type == "by_tag"
  → búsqueda por índice de tags, O(log n)
  
IF query_type == "by_metadata"
  → búsqueda por campos estructurados
  
IF query_type == "full_text"
  → búsqueda semántica si existe, o texto completo fallback
  
Aplicar limit, retornar con relevance_score
```

### Casos de Uso

- Búsqueda de conversaciones
- Recuperación de mensajes específicos
- Análisis de patrones
- ContextAnalyzer

### Dependencias
- Engram (búsqueda optimizada)

---

## 11. DetectDuplicate Skill

### Nombre
**DetectDuplicate**

### Descripción
Evitar duplicados: detectar si un mensaje/archivo ya existe basado en hash o ID.

### Tipo
Memory-Read (híbrido con cache)

### Inputs
```json
{
  "entity_type": "message|file|conversation",
  "entity_hash": "sha256",
  "entity_id": "string"
}
```

### Outputs
```json
{
  "is_duplicate": true|false,
  "existing_id": "string (if duplicate)",
  "confidence": "float (0-1)"
}
```

### Reglas de Ejecución

```
1. Calcular o usar entity_hash proporcionado
2. Buscar en short-term cache (1h TTL)
   IF found → is_duplicate=true
3. Buscar en long-term Engram
   IF found → is_duplicate=true, update cache
4. SI no encontrado → is_duplicate=false
```

### Casos de Uso

- Prevención de duplicados en webhook
- Almacenamiento eficiente de archivos
- Deduplicación de configuración

### Dependencias
- Engram (búsqueda por hash)
- Cache (corta duración)

---

## 12. RateLimitCheck Skill

### Nombre
**RateLimitCheck**

### Descripción
Verificar si usuario/IP ha excedido límites de rate. Aplicar políticas de throttle.

### Tipo
Memory-Read (+ update de contadores)

### Inputs
```json
{
  "user_id": "string",
  "ip_address": "string",
  "endpoint": "string",
  "policy": "burst_limit|per_minute|per_hour|per_day"
}
```

### Outputs
```json
{
  "allowed": true|false,
  "remaining": "int",
  "reset_at": "ISO8601",
  "retry_after": "int (seconds)"
}
```

### Reglas de Ejecución

```
1. Consultar contador en Engram short-term para {user_id, endpoint}
2. SI contador < límite
   THEN allowed=true, increment counter
3. SI contador >= límite
   THEN allowed=false, retry_after = time until reset
4. Aplicar política: burst vs. smooth rate
5. Reset counters según TTL
```

### Casos de Uso

- Prevención de abuso
- Protección de API
- Garantía de calidad de servicio

### Dependencias
- Engram (short-term counters)

---

## Tabla de Compatibilidad de Skills

| Skill | Consume Input | Produce Output | Lee Memoria | Escribe Memoria | Stateless |
|-------|---------------|----------------|-------------|-----------------|-----------|
| ParsePayload | ✓ | ✓ | ✗ | ✗ | ✓ |
| ValidateMessage | ✓ | ✓ | ✗ | ✗ | ✓ |
| ExtractFileMetadata | ✓ | ✓ | ✗ | ✗ | ✓ |
| AuthenticateRequest | ✓ | ✓ | ✓ | ✓ | ✓ |
| StoreMessage | ✓ | ✓ | ✗ | ✓ | ✓ |
| RetrieveHistory | ✓ | ✓ | ✓ | ✗ | ✓ |
| SendToProvider | ✓ | ✓ | ✗ | ✗ | ✓ |
| GenerateToken | ✓ | ✓ | ✗ | ✗ | ✓ |
| LogEvent | ✓ | ✓ | ✗ | ✓ | ✓ |
| QueryMemory | ✓ | ✓ | ✓ | ✗ | ✓ |
| DetectDuplicate | ✓ | ✓ | ✓ | ✓ | ✓ |
| RateLimitCheck | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Patrones de Composición de Skills

### Patrón 1: Pipeline Secuencial
```
ParsePayload → ValidateMessage → StoreMessage
```

### Patrón 2: Branching Condicional
```
ParsePayload → IF type==file → ExtractFileMetadata → StoreMessage
              → ELSE → ValidateMessage → StoreMessage
```

### Patrón 3: Validación en Cascada
```
AuthenticateRequest → RateLimitCheck → ValidateMessage → Proceed
```

### Patrón 4: Enriquecimiento de Contexto
```
StoreMessage → QueryMemory (historial) → enriched_context
```

### Patrón 5: Retry con Exponential Backoff
```
SendToProvider → IF failed AND retryable
                 → wait(exponential)
                 → SendToProvider (retry)
```

---

## Guía de Invocación de Skills

### Desde un Agente

```python
# Ejemplo pseudocódigo

class SendMessageAgent:
    def execute(self, request):
        # 1. Parse
        parse_result = invoke_skill('ParsePayload', {
            'raw_payload': request.body,
            'schema_validation': 'strict'
        })
        
        # 2. Validate
        validation_result = invoke_skill('ValidateMessage', {
            'message': parse_result['message'],
            'constraints': {...}
        })
        
        if not validation_result['valid']:
            return error(validation_result['violations'])
        
        # 3. Authenticate
        auth_result = invoke_skill('AuthenticateRequest', {
            'token': request.headers['Authorization'],
            'request_id': request.id
        })
        
        if not auth_result['authenticated']:
            return error('Unauthorized')
        
        # 4. Send
        send_result = invoke_skill('SendToProvider', {
            'provider_endpoint': ENDPOINT,
            'payload': parse_result['parsed']
        })
        
        # 5. Store
        store_result = invoke_skill('StoreMessage', {
            'conversation_id': parse_result['conversation_id'],
            'message': parse_result['message'],
            'sender': 'agent'
        })
        
        # 6. Log
        invoke_skill('LogEvent', {
            'event_type': 'message.sent',
            'level': 'info',
            'user_id': auth_result['user_id'],
            'metadata': {'message_id': store_result['message_id']}
        })
        
        return success(store_result['message_id'])
```

---

## Escalabilidad y Performance

### Optimizaciones

1. **Skill Caching**: cachear resultados de skills costosos (AuthenticateRequest)
2. **Parallel Execution**: ejecutar skills independientes en paralelo
3. **Async I/O**: skills que hacen HTTP, usar async/await
4. **Batch Operations**: agrupar múltiples inserciones a Engram

### Métricas de Performance

- Latencia por skill (p50, p99)
- Tasa de error por skill
- Cache hit rate (para skills que leen)
- Throughput (mensajes/segundo)

---

## Versionado de Skills

Cada skill mantiene versión para evolución sin breaking changes:

```
ParsePayload v1.0
  - Input: raw_payload (string)
  - Output: parsed (dict)
  
ParsePayload v1.1
  - Input: raw_payload, encoding (new)
  - Output: parsed, encoding_detected (new)
  
[Agents usan ParsePayload@v1.1 gradualmente]
```
