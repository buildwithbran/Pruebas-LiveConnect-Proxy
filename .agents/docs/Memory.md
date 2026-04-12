# Memory.md — Sistema de Memoria Engram

## Visión General

Engram es un sistema de memoria persistente inspirado en grabados neuronales. Funciona en dos capas:

1. **Short-Term Memory (STM)**: contexto de sesión activa, caches, decisiones recientes
2. **Long-Term Memory (LTM)**: histórico persistente, patrones, hechos verificados

Ambas capas están indexadas, consultables y disponibles para agentes y skills.

---

## Arquitectura de Memoria

```
┌─────────────────────────────────────┐
│   Short-Term Memory (STM)           │
│   (Redis, in-memory, 1h TTL)        │
├─────────────────────────────────────┤
│  • Session tokens (cache)            │
│  • Rate limit counters               │
│  • Conversation state (active)       │
│  • Error counters (5 min window)    │
│  • File hashes (duplicate detect)   │
│  • Transaction state                │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│   Long-Term Memory (LTM)            │
│   (SQLite/PostgreSQL, persistent)   │
├─────────────────────────────────────┤
│  • Conversations (complete history)  │
│  • Messages (all metadata)           │
│  • Users & sessions                  │
│  • Files & metadata                  │
│  • Audit logs (append-only)          │
│  • Configuration & policies          │
│  • Patterns & analytics              │
└─────────────────────────────────────┘
                  ↓
         [Indices & Views]
   - By conversation_id
   - By user_id
   - By timestamp
   - By tags/metadata
   - Full-text search
```

---

## 1. Short-Term Memory (STM)

### Propósito
- Minimizar latencia en búsquedas frecuentes
- Mantener estado de sesión activa
- Throttle y anti-abuse
- Transacción y consistencia

### Almacenamiento
**Redis** (recomendado) o in-memory dict con evicción LRU

### Entidades en STM

#### 1.1 Token Cache
```
Key: token:{token_hash}
Value: {
  user_id: string,
  session_id: string,
  expires_at: ISO8601,
  permissions: [string]
}
TTL: 1h
```

Operaciones:
- **Read**: TokenManager valida token, O(1)
- **Write**: GenerateToken inserta nuevo token
- **Evict**: automático por TTL

---

#### 1.2 Rate Limit Counters
```
Key: ratelimit:{user_id}:{endpoint}
Value: {
  count: int,
  reset_at: ISO8601,
  policy: "per_minute|per_hour|per_day"
}
TTL: variable (1m, 1h, 1d)
```

Operaciones:
- **Read**: RateLimitCheck incrementa counter
- **Update**: atomic increment
- **Evict**: manual al reset

---

#### 1.3 Conversation State (Active Sessions)
```
Key: conversation:{conversation_id}
Value: {
  last_seen: ISO8601,
  last_message_id: uuid,
  is_active: boolean,
  participants: [string],
  channel_id: int,
  metadata: {}
}
TTL: 30 min (refresh con cada acción)
```

Operaciones:
- **Read**: ConversationManager, SendMessageAgent
- **Update**: WebhookProcessor, SendMessageAgent actualizan timestamp
- **Evict**: manual después de inactividad

---

#### 1.4 Error Counters (Sliding Window)
```
Key: errors:{source_agent}:{error_type}
Value: {
  count: int,
  window_start: ISO8601,
  window_end: ISO8601
}
TTL: 5 min (sliding window)
```

Operaciones:
- **Read**: ErrorHandler verifica threshold
- **Increment**: ErrorHandler al capturar error
- **Auto-reset**: cuando window expira

---

#### 1.5 File Hash Cache (Deduplicación)
```
Key: filehash:{hash_algorithm}:{file_hash}
Value: {
  file_id: uuid,
  stored_at: ISO8601,
  references: int
}
TTL: 6h
```

Operaciones:
- **Read**: FileHandler busca duplicados
- **Write**: FileHandler after ingestion
- **Increment**: referencias si reutilizado

---

#### 1.6 Transaction State
```
Key: transaction:{transaction_id}
Value: {
  status: "pending|committed|rolled_back",
  operations: [],
  started_at: ISO8601,
  started_by_agent: string
}
TTL: 10 min (cleanup after commit/rollback)
```

Operaciones:
- **Write**: agent inicia transacción
- **Update**: con cada skill invocado
- **Commit/Rollback**: al completar

---

### Operaciones STM

#### Lectura (get)
```python
def read_stm(key: str) -> Optional[dict]:
    """O(1) lookup en STM"""
    value = redis.get(key)
    if value:
        redis.expire(key, ttl)  # refresh TTL
        return deserialize(value)
    return None
```

#### Escritura (set)
```python
def write_stm(key: str, value: dict, ttl: int):
    """O(1) insert/update con TTL"""
    redis.setex(key, ttl, serialize(value))
    emit_event(f"stm.written:{key}")
```

#### Lectura con Fallback a LTM
```python
def read_with_fallback(key: str, query_ltm: callable):
    """
    1. Intentar STM
    2. Si miss, consultar LTM
    3. Cachear resultado en STM
    """
    # Try STM first
    result = read_stm(key)
    if result:
        return result
    
    # Fallback to LTM
    result = query_ltm(key)
    if result:
        write_stm(key, result, ttl=1h)
    return result
```

---

## 2. Long-Term Memory (LTM)

### Propósito
- Persistencia permanente
- Búsquedas complejas (filtros, agregaciones)
- Auditoría y compliance
- Análisis y patrones

### Almacenamiento
**SQLite** (desarrollo) o **PostgreSQL** (producción) con índices

### Esquema LTM

#### Tabla: `engram_conversations`
```sql
CREATE TABLE engram_conversations (
  id TEXT PRIMARY KEY,
  channel_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active', 'paused', 'archived', 'closed'),
  participants TEXT,  -- JSON array
  tags TEXT,  -- JSON array
  metadata TEXT,  -- JSON object
  KEY idx_channel (channel_id),
  KEY idx_status (status),
  KEY idx_updated_at (updated_at)
);
```

Acceso:
- **Lectura**: ConversationManager, ContextAnalyzer
- **Escritura**: WebhookProcessor, SendMessageAgent (update timestamp)
- **Índices**: channel_id, status, updated_at para queries frecuentes

---

#### Tabla: `engram_messages`
```sql
CREATE TABLE engram_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT FOREIGN KEY,
  sender ENUM('usuario', 'agent', 'system'),
  message_type ENUM('text', 'file', 'quick_answer', 'system'),
  message TEXT,
  file_id UUID,  -- reference
  metadata TEXT,  -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_conversation (conversation_id),
  KEY idx_sender (sender),
  KEY idx_created_at (created_at),
  FULLTEXT idx_message (message)
);
```

Acceso:
- **Lectura**: RetrieveHistory, ContextAnalyzer
- **Escritura**: StoreMessage (append-only)
- **Búsqueda**: full-text, by conversation, by sender

---

#### Tabla: `engram_files`
```sql
CREATE TABLE engram_files (
  id TEXT PRIMARY KEY,
  hash TEXT UNIQUE,  -- SHA256 para deduplicación
  original_url TEXT,
  file_name TEXT,
  extension TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  stored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  references INTEGER DEFAULT 1,
  metadata TEXT,  -- JSON
  KEY idx_hash (hash),
  KEY idx_stored_at (stored_at)
);
```

Acceso:
- **Lectura**: FileHandler, DetectDuplicate
- **Escritura**: FileHandler (insert/increment references)
- **Búsqueda**: por hash (deduplicación)

---

#### Tabla: `engram_audit_log`
```sql
CREATE TABLE engram_audit_log (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT,  -- 'message.received', 'auth.failed', etc.
  level ENUM('debug', 'info', 'warning', 'error', 'critical'),
  request_id UUID,
  user_id TEXT,
  ip_address TEXT,
  endpoint TEXT,
  metadata TEXT,  -- JSON
  KEY idx_timestamp (timestamp),
  KEY idx_event_type (event_type),
  KEY idx_user_id (user_id),
  KEY idx_level (level)
);
```

Acceso:
- **Lectura**: Análisis, compliance, debugging
- **Escritura**: LogEvent (append-only, nunca actualizar)
- **Políticas**: retención por 1 año (archivable)

---

#### Tabla: `engram_tokens`
```sql
CREATE TABLE engram_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  is_revoked BOOLEAN DEFAULT FALSE,
  metadata TEXT,  -- JSON
  KEY idx_user_id (user_id),
  KEY idx_expires_at (expires_at)
);
```

Acceso:
- **Lectura**: AuthenticateRequest (validación)
- **Escritura**: GenerateToken, revocation events
- **Limpieza**: borrar tokens expirados diariamente

---

#### Tabla: `engram_sessions`
```sql
CREATE TABLE engram_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  token_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME,
  ip_address TEXT,
  metadata TEXT,  -- JSON
  KEY idx_user_id (user_id),
  KEY idx_last_activity (last_activity)
);
```

Acceso:
- **Lectura**: TokenManager
- **Escritura**: session lifecycle
- **Limpieza**: sesiones inactivas > 7 días

---

### Operaciones LTM

#### Inserción (append-only)
```python
def insert_ltm(table: str, entity: dict):
    """
    Insertar nuevo registro en LTM (nunca actualizar historicamente)
    """
    entity['created_at'] = now()
    db.insert(table, entity)
    emit_event(f"ltm.inserted:{table}:{entity['id']}")
```

#### Búsqueda (con índices)
```python
def query_ltm(table: str, filters: dict, limit: int = 50) -> list:
    """
    Consultar LTM con filtros, usando índices
    """
    query = db.select(table).where(filters).limit(limit)
    return query.execute()
```

#### Actualización (solo timestamps/status)
```python
def update_ltm(table: str, entity_id: str, updates: dict):
    """
    Actualizar campos específicos (timestamp, status)
    NO actualizar datos históricos primarios
    """
    updates['updated_at'] = now()
    db.update(table, entity_id, updates)
    emit_event(f"ltm.updated:{table}:{entity_id}")
```

#### Full-text Search
```python
def search_ltm_fulltext(query_text: str, limit: int = 20) -> list:
    """
    Búsqueda de texto completo en messages
    """
    results = db.query(f"""
    SELECT * FROM engram_messages 
    WHERE MATCH(message) AGAINST('{query_text}' IN NATURAL LANGUAGE MODE)
    LIMIT {limit}
    """)
    return results
```

---

## 3. Flujos de Lectura de Memoria

### Patrón 1: Lectura de Contexto (de Agente)

```
Agent solicita: "Dame contexto de conversación X"
    ↓
1. Buscar en STM (conversation:X)
   - HIT: refresco TTL, retorno
   - MISS: → paso 2
2. Buscar en LTM (engram_conversations.where(id=X))
   - Encontrado: cachear en STM, retorno
   - No: error "Conversation not found"
```

**Latencia típica**:
- STM hit: 1-5ms
- LTM hit: 50-200ms
- Fallback: 300ms (con cacheo)

---

### Patrón 2: Búsqueda de Historial

```
Agent solicita: "Mensajes de conversación X en últimas 24h"
    ↓
1. Consultar LTM (engram_messages)
   - WHERE conversation_id = X
   - AND created_at >= now() - 24h
   - ORDER BY created_at ASC
   - LIMIT 50
2. Returnar resultados + has_more flag
```

**Latencia típica**: 50-500ms

---

### Patrón 3: Validación de Token

```
Request llega con token
    ↓
1. Buscar en STM (token:{hash})
   - HIT: validar expiry, retorno {valid: true/false}
   - MISS: → paso 2
2. Buscar en LTM (engram_tokens.where(token_hash={hash}))
   - Encontrado + no expirado: cachear STM, retorno {valid: true}
   - Encontrado + expirado: retorno {valid: false}
   - No encontrado: retorno {valid: false}
```

**Latencia típica**:
- STM hit: 1-5ms (99% de casos)
- LTM hit: 50-100ms (1% de casos)

---

### Patrón 4: Deduplicación de Archivo

```
FileHandler recibe archivo nuevo
    ↓
1. Calcular hash SHA256
2. Buscar en STM (filehash:{hash})
   - HIT: retorno {is_duplicate: true, file_id: ...}
   - MISS: → paso 3
3. Buscar en LTM (engram_files.where(hash={hash}))
   - Encontrado: cachear STM, retorno {is_duplicate: true}
   - No: procesarlonormalmente, cachear STM, retorno {is_duplicate: false}
```

---

## 4. Flujos de Escritura de Memoria

### Patrón 1: Guardar Mensaje

```
WebhookProcessor recibe mensaje
    ↓
1. Validar conversation_id (debe existir o crearse)
2. Generar message_id
3. Insertar en LTM (engram_messages)
4. Actualizar LTM (engram_conversations.updated_at)
5. Actualizar STM (conversation:{id}.last_message_id)
6. Emitir evento: message.stored
```

**Transaccionalidad**: debería ser atomic (todo o nada)

---

### Patrón 2: Loguear Evento de Auditoría

```
Agent completa operación
    ↓
1. Generar log_id
2. Enriquecer con contexto: user_id, ip, endpoint, request_id
3. Insertar en LTM (engram_audit_log)
4. SI level == "critical": emitir alerta inmediata
5. Evento registrado para análisis posterior
```

**Garantía**: append-only, inmutable para compliance

---

### Patrón 3: Cachear Token y STM

```
Token generado por GenerateToken
    ↓
1. Firmar token JWT
2. Calcular expiry: now() + 8h
3. Insertar en LTM (engram_tokens) con expires_at
4. Cachear en STM (token:{hash}) con TTL=1h
5. Emitir evento: token.generated
```

**Latencia**: LTM insert + STM insert ~10-50ms

---

## 5. Índices y Optimización

### Índices en LTM

```sql
-- Conversaciones
CREATE INDEX idx_conversation_channel ON engram_conversations(channel_id);
CREATE INDEX idx_conversation_updated ON engram_conversations(updated_at DESC);
CREATE INDEX idx_conversation_status ON engram_conversations(status);

-- Mensajes
CREATE INDEX idx_message_conversation ON engram_messages(conversation_id, created_at DESC);
CREATE INDEX idx_message_sender ON engram_messages(sender);
CREATE INDEX idx_message_created ON engram_messages(created_at DESC);
CREATE FULLTEXT INDEX idx_message_text ON engram_messages(message);

-- Files
CREATE UNIQUE INDEX idx_file_hash ON engram_files(hash);
CREATE INDEX idx_file_stored ON engram_files(stored_at DESC);

-- Audit
CREATE INDEX idx_audit_timestamp ON engram_audit_log(timestamp DESC);
CREATE INDEX idx_audit_event ON engram_audit_log(event_type);
CREATE INDEX idx_audit_user ON engram_audit_log(user_id);

-- Tokens
CREATE INDEX idx_token_user ON engram_tokens(user_id);
CREATE INDEX idx_token_expires ON engram_tokens(expires_at);
```

### Query Plans (recomendados)

**Query: Obtener últimos 20 mensajes de conversación**
```sql
SELECT * FROM engram_messages
WHERE conversation_id = ? 
ORDER BY created_at DESC
LIMIT 20;

-- Index: (conversation_id, created_at DESC)
-- Expected: 50ms, 10-100 rows touched
```

**Query: Buscar conversaciones activas por canal**
```sql
SELECT * FROM engram_conversations
WHERE channel_id = ? AND status = 'active'
ORDER BY updated_at DESC
LIMIT 50;

-- Index: (channel_id, status, updated_at DESC)
-- Expected: 30ms, 100-500 rows touched
```

---

## 6. Reglas de Escritura en Engram

### SIEMPRE guardar:
- Mensajes (entrada de usuario, salida de agente)
- Eventos críticos (auth, error, transaction)
- Cambios de estado (conversation, token)
- Metadata de auditoría

### NUNCA sobrescribir:
- Mensajes históricos
- Audit logs
- Tokens expirados
- Conversations (solo timestamp/status)

### Limpiar regularmente:
- Tokens expirados (diarios)
- STM entries (TTL automático)
- Sesiones inactivas > 7 días (semanales)
- Audit logs > 1 año (anuales)

---

## 7. Operaciones Atómicas y Transacciones

### Guardar Mensaje (debe ser atómico)
```python
def save_message_atomic(conversation_id: str, message: dict):
    with db.transaction():
        # 1. Insert message
        message_id = db.insert('engram_messages', {
            'id': generate_uuid(),
            'conversation_id': conversation_id,
            'message': message['text'],
            'created_at': now()
        })
        
        # 2. Update conversation
        db.update('engram_conversations', conversation_id, {
            'updated_at': now(),
            'last_message_id': message_id
        })
        
        # 3. Update STM
        update_stm(f"conversation:{conversation_id}", {
            'last_message_id': message_id,
            'last_updated': now()
        })
    
    # 4. Emit event (fuera de transacción)
    emit_event('message.stored', message_id)
```

**Garantía**: Si falla en cualquier paso, rollback completo

---

## 8. Recuperación ante Fallos

### Backup y Recuperación
- **Backup LTM**: diario (full) + horario (incremental)
- **Replicación STM**: contraño no requerido (cache, reconstruible)
- **Recovery Point Objective (RPO)**: 1 hora
- **Recovery Time Objective (RTO)**: 15 minutos

### Consistencia
- **Eventual Consistency**: STM puede estar adelante de LTM por segundos
- **Strong Consistency**: para operaciones sensibles (auth, token), leer LTM primero
- **Conflict Resolution**: last-write-wins (timestamp) para actualizaciones

---

## 9. Monitoreo y Observabilidad

### Métricas por Memoria

**STM**:
- Cache hit rate (goal: >95%)
- Latencia p50/p99 (goal: <10ms)
- Memory usage (goal: <500MB)
- Eviction rate (goal: <5/min)

**LTM**:
- Query time p50/p99 (goal: <100ms)
- Disk usage (goal: <10GB)
- Index efficiency (goal: >90%)
- Replication lag (goal: <5s)

### Alertas
- STM memory > 80% → increase capacity
- LTM query time > 500ms → check indexes
- Replication lag > 30s → investigate
- Audit log growth > 100MB/day → review retention

---

## 10. Ejemplo Completo: Flujo de Webhook hasta Almacenamiento

```
1. Webhook llega: {id_conversacion, message:{texto: "Hola"}}
    
2. MessageRouter clasifica → WebhookProcessor
    
3. WebhookProcessor.execute():
    a. ParsePayload skill: {parsed: {...}, errors: []}
    b. ValidateMessage skill: {valid: true}
    c. Llamar ConversationManager: dame contexto de LCWAP|753|123
       - Busca STM (conversation:LCWAP|753|123) → MISS
       - Busca LTM → HIT: {channel_id: 753, status: 'active'}
       - Cachea en STM con TTL 30min
    d. StoreMessage skill:
       - Generar message_id = "msg-abc123"
       - INSERT engram_messages: {id, conversation_id, message, sender, created_at}
       - UPDATE engram_conversations: updated_at = now()
       - UPDATE STM: conversation:LCWAP|753|123 = {last_message_id, last_updated}
    e. LogEvent skill:
       - INSERT engram_audit_log: {event_type: 'message.received', ...}
    f. Emitir evento: webhook.stored
    
4. Responder cliente: {status: "received", message_id: "msg-abc123"}

Total latency: 100-300ms (mayoría en LTM insert)
```

---

## Resumen: Engram vs. Traditional DB

| Aspecto | Engram STM | Engram LTM | Traditional DB |
|---------|-----------|-----------|-----------------|
| **Latencia** | <10ms | <100ms | 50-500ms |
| **Throughput** | 100k ops/s | 10k ops/s | 5k-20k ops/s |
| **Durabilidad** | No | Sí | Sí |
| **Consistencia** | Eventual | Strong | Strong |
| **Queryabilidad** | Limitado (keys) | Completa (SQL) | Completa (SQL) |
| **Caso de Uso** | Sesiones, cache | Histórico, auditoría | Todo |

Engram proporciona lo mejor de ambos mundos: velocidad + persistencia + queryabilidad.
