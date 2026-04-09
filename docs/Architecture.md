# Architecture.md — Arquitectura del Sistema Multi-Agente

## Visión General

La arquitectura implementa un sistema desacoplado, escalable y resiliente basado en agentes autónomos que orquestan skills mediante un sistema de memoria persistente tipo Engram.

```
┌──────────────────────────────────────────────────────────────────┐
│                     ENTRADA DEL SISTEMA                          │
│    (Webhook, API Request, UI Action, Event, Error)              │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ↓
           ┌──────────────────┐
           │  MessageRouter   │  ← Enrutador central
           │    (Agente)      │     Clasifica y enruta
           └────┬─────────────┘
                │
    ┌───────────┼───────────┬─────────────┬────────────┐
    ↓           ↓           ↓             ↓            ↓
┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────┐ ┌──────────┐
│Webhook  │ │SendMsg   │ │Config      │ │Error   │ │Token     │
│Processor│ │Agent     │ │Agent       │ │Handler │ │Manager   │
│(Agente) │ │(Agente)  │ │(Agente)    │ │(Agente)│ │(Agente)  │
└────┬────┘ └────┬─────┘ └────┬───────┘ └───┬────┘ └────┬─────┘
     │           │            │             │           │
     └───────────┼────────────┼─────────────┼───────────┘
                 │ Skills                   │
                 ↓                          ↓
         ┌───────────────────────────────────────────┐
         │  EXECUTION LAYER (Skills)                 │
         ├───────────────────────────────────────────┤
         │ • ParsePayload                            │
         │ • ValidateMessage                         │
         │ • StoreMessage                            │
         │ • RetrieveHistory                         │
         │ • AuthenticateRequest                     │
         │ • SendToProvider                          │
         │ • LogEvent                                │
         │ • QueryMemory                             │
         │ • ... (12 skills)                         │
         └───────────┬───────────────────────────────┘
                     │
                     ↓
      ┌──────────────────────────────────────┐
      │      MEMORY LAYER (Engram)           │
      ├──────────────────────────────────────┤
      │                                      │
      │  STM: Redis/In-Memory (1h TTL)       │
      │  • Token cache                       │
      │  • Rate limit counters               │
      │  • Active conversations              │
      │  • Error windows                     │
      │                                      │
      │  LTM: SQLite/PostgreSQL (persistent) │
      │  • Conversations                     │
      │  • Messages                          │
      │  • Files                             │
      │  • Audit logs                        │
      │  • Users & sessions                  │
      │                                      │
      └───────────┬────────────────────────────┘
                  │
                  ↓
         ┌─────────────────┐
         │   Índices       │
         │  & Queries      │
         └─────────────────┘
                  │
                  ↓
              [Storage]
          (Redis, SQLite/PostgreSQL)
```

---

## 1. Componentes Principales

### 1.1 Capa de Enrutamiento
**Componente**: MessageRouter

- Validación inicial de requests
- Clasificación de tipo de evento
- Asignación a agente especializado
- Respuesta provisional al cliente

**Responsabilidades críticas**:
- No modificar payload (puro routing)
- Rechazar early si validación falla
- Medir latencia por ruta

---

### 1.2 Capa de Agentes (Decision Layer)

**Componentes**: 8 agentes especializados

Cada agente:
- Toma decisiones basadas en estado
- Orquesta skills para cumplir objetivo
- Consulta Engram para contexto
- Emite eventos de cambio de estado
- Maneja errores locales

**Comunicación entre agentes**:
- Directa: HandOff (MessageRouter → WebhookProcessor)
- Indirect: Memory-driven (ConversationManager consulta LTM)
- Event-driven: emisión de eventos que otros agentes escuchan

**Paralelismo**:
- Máximo 2-3 agentes activos en paralelo (no hay contención)
- Ejemplo: WebhookProcessor + SendMessageAgent pueden ejecutarse simultáneamente

---

### 1.3 Capa de Ejecución (Skills)

**Componentes**: 12 skills atómicas

Características:
- Stateless por defecto
- Validaciones explícitas
- Manejo de errores local
- Contratos claros (Input/Output)
- Reutilizables por múltiples agentes

**Composición**:
- Agentes componen skills en pipelines
- Skills se invocan secuencialmente O en paralelo (si independientes)

**Ejemplo de pipeline**:
```
ParsePayload → ValidateMessage → AuthenticateRequest → StoreMessage → LogEvent
```

---

### 1.4 Capa de Memoria (Engram)

**Componentes**: 
- STM: Redis/In-Memory (cache rápida)
- LTM: SQLite/PostgreSQL (persistente)

Responsabilidades:
- Proporcionar contexto a agentes
- Mantener consistencia transaccional
- Indexación y búsqueda
- Auditoría y compliance

**Garantías**:
- STM: eventual consistency (1-5s lag)
- LTM: strong consistency (transacciones)

---

## 2. Flujo de Ejecución General

```
INPUT
  ↓
MessageRouter
  • Parsejar request básico
  • Validar estructura
  • Clasificar tipo
  • Enrutar agente
  ↓
Selected Agent
  • Consultar Engram (contexto)
  • Decidir acción
  • Orquestar skills
  • Manejar errores
  ↓
Skills (secuenciales o paralelos)
  • Ejecutar operación
  • Retornar resultado
  • Llenar estado
  ↓
Actualizar Engram
  • STM: cache invalidation
  • LTM: persistencia
  • Transacción completa
  ↓
Emitir Eventos
  • Otros agentes pueden reaccionar
  • Logging y observabilidad
  ↓
RESPUESTA
```

---

## 3. Patrones de Orquestación

### Patrón 1: Secuencial Lineal

```
Webhook → WebhookProcessor → ParsePayload → ValidateMessage → StoreMessage
                                                                     ↓
                                              UpdateEngram ← LogEvent
                                                     ↓
                                           Emit Events → Response
```

**Cuándo**: Procesamiento simple, sin ramificaciones

---

### Patrón 2: Condicional (Branching)

```
SendMessageAgent
  ↓
AuthenticateRequest
  ├─ Success → ParsePayload → ValidateMessage
  │               ↓
  │            SendToProvider
  │               ↓
  │            StoreMessage
  │
  └─ Fail → ErrorHandler → Respond 401
```

**Cuándo**: Validaciones y decisiones tempranas

---

### Patrón 3: Parallel Skill Execution

```
WebhookProcessor
  ├─ ParsePayload
  │      ├─ ExtractFileMetadata (if file)
  │      └─ ValidateMessage (if text)
  │
  ├─ QueryMemory (conversation context) [paralelo]
  │
  ├─ StoreMessage [espera ParsePayload]
  │
  └─ LogEvent [independiente]
```

**Cuándo**: Skills independientes, no hay dependencias

**Overhead**: Mínimo en Python con asyncio/threading

---

### Patrón 4: Fallback y Retry

```
SendToProvider
  ↓
Success? 
  ├─ Yes → StoreMessage → Response OK
  └─ No → ErrorHandler
           ├─ Retryable? (5xx, timeout)
           │  ├─ Retries < MAX? → schedule_retry (exponential backoff)
           │  └─ Retries == MAX? → escalate
           └─ Non-retryable (4xx) → Respond error
```

**Garantía**: Toda operación fallida se intenta al menos 3 veces antes de escalar

---

### Patrón 5: Agent Handoff

```
MessageRouter classifies "config_change"
  ↓
Enruta a ConfigurationAgent
  ↓
ConfigurationAgent.execute()
  ├─ Validar cambio
  ├─ Invocar skill específica
  ├─ Actualizar Engram
  ├─ Notificar agentes afectados
  └─ Emitir evento: config.updated
```

**Comunicación**: 
- Síncrona: ConfigurationAgent → ConversationManager (notification)
- Asíncrona: evento emitido, otros agentes escuchan si les interesa

---

## 4. Orquestación Central vs. Decentalizada

### Enfoque Híbrido (Recomendado)

**Centralizado**:
- MessageRouter: decisión inicial (single entry point)
- ErrorHandler: manejo de fallos (single escalation point)

**Descentralizado**:
- Agentes toman decisiones locales
- Skills ejecutan sin coordinación central
- Memoria compartida para coherencia

**Ventajas**:
- Simplicidad: entrada clara
- Escalabilidad: decisiones distribuidas
- Resilencia: fallos localizados

---

## 5. Ciclo de Transacción Típico

### Caso: Webhook Entrante

```
Time    Component           Action                 Engram Update
────────────────────────────────────────────────────────────────
T+0ms   MessageRouter       Recibe webhook
T+5ms                       Clasifica tipo         STM: classify_event
T+10ms  WebhookProcessor    ParsePayload           (no update)
T+20ms                      ValidateMessage        (no update)
T+30ms                      QueryMemory            STM read
T+40ms                      StoreMessage           LTM insert (transact)
T+50ms                      LogEvent               LTM insert audit
T+55ms                      UpdateSTM              STM update (conv cache)
T+60ms                      Emit Events            (event bus)
T+65ms  Response            Retorna 200 OK
────────────────────────────────────────────────────────────────
Total latency: ~65ms (sin I/O de network externo)
```

---

## 6. Inconsistencias y Resolución

### Problema: Race Condition

**Escenario**:
```
T1: WebhookProcessor lee conversation state (T+0)
T2: SendMessageAgent actualiza conversation (T+5)
T1: WebhookProcessor actualiza con información antigua (T+10)
```

**Solución**:
1. Versioned writes: cada entidad tiene `version` field
2. Optimistic locking: retry si version cambió
3. Last-write-wins: timestamp como tiebreaker

**Implementación**:
```python
def update_conversation_atomic(conversation_id, updates, expected_version):
    with db.transaction():
        existing = db.get('engram_conversations', conversation_id)
        if existing['version'] != expected_version:
            raise OptimisticLockError("Version mismatch")
        
        updates['version'] = existing['version'] + 1
        updates['updated_at'] = now()
        db.update('engram_conversations', conversation_id, updates)
```

---

### Problema: Cascada de Errores

**Escenario**:
Provider API está down → SendMessageAgent falla → ErrorHandler intenta retry → Queue se llena → Sistema débil

**Solución**: Circuit Breaker

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
    
    def call(self, func, *args):
        if self.state == "open":
            if now() - self.last_failure_time > self.timeout:
                self.state = "half-open"
                self.failure_count = 0
            else:
                raise CircuitBreakerOpenError()
        
        try:
            result = func(*args)
            if self.state == "half-open":
                self.state = "closed"
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = now()
            if self.failure_count >= self.failure_threshold:
                self.state = "open"
                emit_alert("circuit_breaker_open")
            raise
```

---

## 7. Escalabilidad

### Horizontal Scaling

**Problema**: Un solo MessageRouter es bottleneck

**Solución**: Load Balancer + Multiple Instances

```
┌──────────────────────────────────────────┐
│         Load Balancer (nginx)            │
└────┬────────────────────────────┬────────┘
     │                            │
   ┌─┴────────────┐        ┌─────┴──────┐
   │MessageRouter1│        │MessageRouter2│  (stateless)
   └─┬────────────┘        └─────┬──────┘
     │                           │
     └───────────┬───────────────┘
                 │
            [Shared Engram]
         Redis (STM) + PostgreSQL (LTM)
```

**Consideraciones**:
- MessageRouter: stateless, escala fácilmente
- Agentes: pueden ejecutarse en workers (Job Queue)
- Engram: centralizada (replicada para HA)

---

### Vertical Scaling

**Problema**: Engram LTM está lenta

**Solución**: Índices, caché, particionamiento

```
LTM Particionado por conversation_id:
  Shard 1: conversations [A-M]
  Shard 2: conversations [N-Z]
  
Cada shard: 
  - Índices locales
  - Replica para HA
  - Backup diario
```

---

## 8. Monitoreo y Observabilidad

### Métrica Principales

| Métrica | Target | Herramienta |
|---------|--------|-------------|
| Response time p99 | <500ms | Prometheus |
| Error rate | <1% | Datadog |
| STM hit rate | >95% | Redis Monitor |
| LTM query time p99 | <100ms | PostgreSQL EXPLAIN |
| Agent throughput | >100 msg/s | Custom metrics |
| Memory usage | <2GB | Node exporter |

### Alertas

- Response time > 1000ms → check LTM indexes
- Error rate > 5% → check ErrorHandler escalations
- STM memory > 80% → manual eviction review
- Circuit breaker open → provider issue detected

---

## 9. Security Considerations

### Autenticación
- TokenManager valida cada request
- Tokens cacheados en STM (rápido)
- Revocación inmediata en LTM

### Autorización
- ACL por user_id
- Conversación access control: solo owner puede ver
- Rate limiting por endpoint

### Encriptación
- TLS en tránsito (todos los endpoints)
- Tokens haen en LTM (no plaintext)
- Credential storage encriptada

### Auditoría
- Append-only audit log (engram_audit_log)
- Compliance: quien, qué, cuándo, por qué
- Retención: mínimo 1 año

---

## 10. Deployment Topology

### Desarrollo (Single Machine)
```
┌──────────────────────────────────┐
│ Flask App (MessageRouter + Agents)│
├──────────────────────────────────┤
│ Redis (STM) + SQLite (LTM)       │
└──────────────────────────────────┘
```

### Testing (Docker Compose)
```
┌────────────────┐  ┌─────────────┐  ┌────────────────────┐
│  Flask Service │→ │ Redis Srv   │→ │ PostgreSQL Service │
├ Port 5000     │  ├ Port 6379   │  ├ Port 5432         │
└────────────────┘  └─────────────┘  └────────────────────┘
```

### Producción (Kubernetes)
```
Pod Deployment:
  - 3x Flask replicas (MessageRouter)
  - Redis Sentinel (STM HA)
  - PostgreSQL HA (LTM)
  - Monitoring: Prometheus + Grafana
  - Logging: ELK Stack
  - Tracing: Jaeger
```

---

## Resumen de Decisiones Arquitectónicas

| Decisión | Razón | Trade-off |
|----------|-------|-----------|
| **8 Agentes** | SRP, claridad, testability | Complejidad inicial |
| **12 Skills** | Reutilización, composición | Overhead de dispatch |
| **Dual Memory** | Velocidad + persistencia | Complejidad de sync |
| **MessageRouter central** | Single entry point | Bottleneck potencial |
| **Event-driven** | Loose coupling | Eventual consistency |
| **Stateless Skills** | Escalabilidad | State pasa en memoria |

---

## Próximos Pasos

1. **Implementar core**: MessageRouter + ParsePayload skill
2. **Integrar STM**: Redis cache layer
3. **Completar LTM**: SQLite/PostgreSQL schemas
4. **Agregar observabilidad**: logging y metrics
5. **Testing**: unitario, integración, e2e
6. **Deployment**: Docker, Kubernetes

Véase `RuntimeFlow.md` para ejemplos concretos de ejecución.
