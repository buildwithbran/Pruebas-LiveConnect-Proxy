# MULTI-AGENT SYSTEM WITH ENGRAM MEMORY — Índice de Documentación

## Descripción General

Este proyecto implementa un **sistema multi-agente escalable e inteligente** inspirado en Engram (memoria persistente tipo grabado neuronal). 

La arquitectura incorpora:
- **8 Agentes autónomos** especializados con criterios claros de decisión
- **12 Skills reutilizables** desacopladas y stateless
- **Engram (Dual-Layer Memory)**: STM (Redis) + LTM (PostgreSQL)
- **Event-driven design** con manejo de errores resiliente
- **Auditoría completa** y trazabilidad de operaciones

---

## Estructura de Documentación

### 1. **Agents.md** — Definición de Agentes
**📍 [docs/Agents.md](./Agents.md)**

Define los 8 agentes del sistema:

1. **MessageRouter** — Enrutador central, clasificación de eventos
2. **WebhookProcessor** — Procesamiento de webhooks entrantes
3. **SendMessageAgent** — Orquestación de envío de mensajes
4. **ConversationManager** — Gestión de estado y contexto de conversaciones
5. **TokenManager** — Autenticación y validación de tokens
6. **FileHandler** — Ciclo de vida de archivos, deduplicación
7. **ErrorHandler** — Manejo de fallos, retry, circuit breaker
8. **ConfigurationAgent** — Gestión dinámica de configuración

**Cada agente incluye**:
- Propósito y responsabilidades
- Inputs/Outputs explícitos
- Reglas de decisión
- Integración con Engram (qué lee/escribe)
- Relaciones con otros agentes
- Triggers y ejemplos de flujo

**Leer si**: Necesitas entender cómo toma decisiones el sistema, cuáles son los puntos de intervención, cómo se orquestan operaciones.

---

### 2. **Skills.md** — Habilidades Funcionales
**📍 [docs/Skills.md](./Skills.md)**

Define las 12 skills reutilizables:

1. **ParsePayload** — Parsear y normalizar JSON
2. **ValidateMessage** — Validar contenido y conformidad
3. **ExtractFileMetadata** — Extraer metadata de archivos
4. **AuthenticateRequest** — Validar tokens y sesiones
5. **StoreMessage** — Persistir mensajes en Engram
6. **RetrieveHistory** — Obtener historial filtrado
7. **SendToProvider** — HTTP call con retry logic
8. **GenerateToken** — Generar JWT tokens
9. **LogEvent** — Registrar auditoría
10. **QueryMemory** — Búsqueda flexible en Engram
11. **DetectDuplicate** — Deduplicación por hash
12. **RateLimitCheck** — Validación de límites

**Cada skill incluye**:
- Tipo (Functional / Memory-Read / Memory-Write / Hybrid)
- Inputs/Outputs estructurados
- Reglas de ejecución
- Casos de uso y ejemplos prácticos
- Dependencias

**Características comunes**:
- ✓ Stateless (contexto pasa como parámetro)
- ✓ Invocables dinámicamente
- ✓ Validaciones explícitas
- ✓ Manejo de errores local

**Leer si**: Necesitas implementar nuevas capacidades, entender cómo se ejecutan operaciones atómicas, o componer skills en pipelines.

---

### 3. **Memory.md** — Sistema Engram
**📍 [docs/Memory.md](./Memory.md)**

Define el sistema de memoria persistente en dos capas:

#### Short-Term Memory (STM) — Redis/In-Memory
- **TTL**: 1 hora típicamente
- **Propósito**: Cache ultra-rápido para operaciones frecuentes
- Entidades:
  - Token cache (validación <5ms)
  - Rate limit counters (ventanas deslizantes)
  - Conversation state (sesiones activas)
  - Error counters (sliding windows)
  - File hashes (deduplicación)
  - Transaction state

#### Long-Term Memory (LTM) — SQLite/PostgreSQL
- **Propósito**: Persistencia, búsquedas complejas, auditoría
- Tablas:
  - `engram_conversations` — conversaciones con metadata
  - `engram_messages` — histórico de mensajes
  - `engram_files` — metadata de archivos
  - `engram_audit_log` — append-only auditoría
  - `engram_tokens` — sesiones de usuario
  - `engram_sessions` — tracking de sesiones

#### Flujos de Lectura/Escritura
- Patrón STM-first: buscar en cache, fallback a LTM
- Transacciones ACID en LTM
- Operaciones atómicas multi-tabla
- Recovery ante fallos

**Índices y Optimización**:
- Índices para queries frecuentes
- Full-text search en messages
- Particionamiento opcional por conversation_id

**Leer si**: Necesitas entender cómo se mantiene consistencia, cómo se cachea optimizadamente, o diseñar nuevas tablas/índices.

---

### 4. **Architecture.md** — Arquitectura del Sistema
**📍 [docs/Architecture.md](./Architecture.md)**

Describe la arquitectura completa:

#### Componentes Principales
1. **Capa de Enrutamiento** — MessageRouter (single entry point)
2. **Capa de Agentes** — 8 agentes especializados (decision layer)
3. **Capa de Ejecución** — 12 skills (execution layer)
4. **Capa de Memoria** — Engram (STM + LTM)

#### Patrones de Orquestación
- Secuencial lineal
- Condicional (branching)
- Parallel skill execution
- Fallback y retry
- Agent handoff

#### Escalabilidad
- **Horizontal**: Load balancer + multiple instances (stateless)
- **Vertical**: Índices, caché, particionamiento

#### Consideraciones Críticas
- Race conditions → Optimistic locking
- Cascada de errores → Circuit breaker
- Consistencia → Eventual + Strong (por tipo)

#### Security
- TLS obligatorio
- Token management
- ACL por usuario
- Append-only audit log

**Leer si**: Necesitas entender cómo escala el sistema, cómo se maneja resilencia, o diseñar nuevas integraciones.

---

### 5. **RuntimeFlow.md** — Flujos de Ejecución en Tiempo Real
**📍 [docs/RuntimeFlow.md](./RuntimeFlow.md)**

Ejemplos concretos paso-a-paso de 6 escenarios reales:

#### Escenario 1: Webhook Entrante ✓
**Timestamp: ~30ms**
- Usuario envía mensaje → Webhook llega → parsea → valida → almacena en Engram
- Muestra interacción entre MessageRouter → WebhookProcessor → Skills
- Detalla estado de STM/LTM en cada paso

#### Escenario 2: Envío de Mensaje desde UI ✓
**Timestamp: ~26ms**
- Agente clicks "Enviar" → validación de token → consulta ConversationManager → envía a provider → almacena localmente
- Muestra validación en cascada y optimizaciones (STM hit rate)

#### Escenario 3: Error Handling y Retry ✓
**Timestamp: 5620ms (con reintentos exponenciales)**
- Provider timeout → ErrorHandler captura → decision: retry → exponential backoff → éxito
- Muestra policy de reintentos y circuit breaker

#### Escenario 4: Rate Limiting ✓
**Timestamp: ~2ms**
- Usuario excede límite de 5 msg/minuto → rechazo → notificación
- Muestra contador deslizante en STM

#### Escenario 5: Deduplicación de Archivo ✓
**Timestamp: ~25ms**
- Webhook con archivo → calcula hash → detecta duplicado → reutiliza referencia
- Muestra ahorro de recursos y deduplicación

#### Escenario 6: Configuración de Webhook ✓
**Timestamp: ~35ms**
- Usuario configura URL → validación → envía a provider → persistencia local
- Muestra ConfigurationAgent en acción

**Cada escenario incluye**:
- Timeline detallado milisegundo-by-milisegundo
- Pseudocódigo ejecutable
- Estados de Engram (antes/después)
- HTTP requests/responses completics
- Consumo de recursos

**Leer si**: Necesitas debuggear un flujo específico, entender timing y latencia, o validar un scenario nuevo.

---

## Cómo Usar Esta Documentación

### Para Implementadores
1. **Comienza con**: Architecture.md (visión general)
2. **Entiende**: Skills.md (qué se puede hacer)
3. **Profundiza**: Agents.md (quién toma decisiones)
4. **Valida**: RuntimeFlow.md (casos reales)
5. **Optimiza**: Memory.md (indexing y cache)

### Para Debuggear
1. **Error en proceso X**: Ve a RuntimeFlow.md para ese scenario
2. **Memory leak**: Ve a Memory.md (operaciones de escritura)
3. **Latencia alta**: Revisa Agents.md + Architecture.md (crítico path)
4. **Inconsistencia**: Memory.md (transacciones y sync)

### Para Extender
1. **Agente nuevo**: Copia template de Agents.md
2. **Skill nueva**: Copia template de Skills.md
3. **Tabla nueva**: Agrega a Memory.md (LTM)
4. **Flujo nuevo**: Documenta en RuntimeFlow.md

---

## Decisiones Arquitectónicas Clave

| Decisión | Razón | Trade-off |
|----------|-------|-----------|
| **8 Agentes** | SRP, claridad, testability | Complejidad inicial |
| **12 Skills** | Reutilización, composición | Overhead de dispatch |
| **Dual Memory** | Velocidad + persistencia | Complejidad de sync |
| **MessageRouter central** | Single entry point, clarity | Bottleneck potencial |
| **Event-driven** | Loose coupling, flexibility | Eventual consistency |
| **Stateless Skills** | Escalabilidad, testability | State pasa en parámetros |
| **Engram Engram STM** | <10ms latency para auth/rate limits | Memory overhead (mitigable) |
| **Append-only audit log** | Compliance, non-repudiation | Storage creciente |

---

## Métricas de Performance Objetivo

| Métrica | Objetivo | Herramienta |
|---------|----------|------------|
| P99 Response Time | <500ms | Prometheus |
| STM Hit Rate | >95% | Redis INFO |
| Error Rate | <1% | DataDog |
| LTM Query P99 | <100ms | PostgreSQL logs |
| Throughput | >100 msg/s | Custom counter |
| Memory Usage | <2GB | k8s metrics |
| Audit Log Coverage | 100% | log validation |

---

## Roadmap de Implementación

### Fase 1: Core (Semana 1-2)
- [ ] Implementar MessageRouter (enrutador)
- [ ] Implementar ParsePayload skill
- [ ] Integrar ParsePayload en MessageRouter
- [ ] Testing unitario ParsePayload

### Fase 2: Agents Básicos (Semana 3-4)
- [ ] Implementar WebhookProcessor agent
- [ ] Implementar StoreMessage skill
- [ ] Implementar LogEvent skill
- [ ] Integration tests webhook → store

### Fase 3: Autenticación (Semana 5-6)
- [ ] Implementar TokenManager agent
- [ ] Implementar AuthenticateRequest skill
- [ ] Implementar RateLimitCheck skill
- [ ] Security tests

### Fase 4: LTM (Semana 7-8)
- [ ] PostgreSQL setup (dev + prod)
- [ ] Schemas y índices (Memory.md)
- [ ] Migrations setup
- [ ] Backup strategy

### Fase 5: STM + Optimización (Semana 9-10)
- [ ] Redis setup
- [ ] Implementar caching layer
- [ ] Tune índices basado en queries reales
- [ ] Performance testing

### Fase 6: Observabilidad (Semana 11-12)
- [ ] Logging (structured JSON)
- [ ] Metrics (Prometheus)
- [ ] Tracing (Jaeger)
- [ ] Dashboards (Grafana)

---

## Glossario

| Término | Definición |
|---------|-----------|
| **Agent** | Entidad autónoma que toma decisiones y orquesta skills |
| **Skill** | Función atómica, stateless, reutilizable |
| **Engram** | Sistema de memoria dual-layer (STM + LTM) |
| **STM** | Short-Term Memory: Redis/in-memory, ultra-rápida |
| **LTM** | Long-Term Memory: PostgreSQL/SQLite, persistente |
| **Handoff** | Transferencia de responsabilidad entre agentes |
| **Circuit Breaker** | Patrón para prevenir cascada de fallos |
| **Eventual Consistency** | STM puede estar adelantado a LTM por segundos |
| **Strong Consistency** | LTM siempre reflects truth via transactions |
| **Append-only log** | Auditoría inmutable para compliance |

---

## Referencias Cruzadas Rápidas

### Por Componente
- **MessageRouter**: Agents.md § 1, Architecture.md § 1.1
- **WebhookProcessor**: Agents.md § 2, RuntimeFlow.md § Escenario 1
- **Engram Memory**: Memory.md (completo)
- **Skills**: Skills.md (completo)
- **ErrorHandling**: Agents.md § 7, RuntimeFlow.md § Escenario 3

### Por Concepto
- **Rate Limiting**: Skills.md § 12, RuntimeFlow.md § Escenario 4
- **Deduplicación**: Skills.md § 11, RuntimeFlow.md § Escenario 5
- **Escalabilidad**: Architecture.md § 7
- **Seguridad**: Architecture.md § 9
- **Transacciones Atómicas**: Memory.md § 7, RuntimeFlow.md (todos)

---

## Próximos Pasos

1. **Lee Architecture.md** para entender la visión completa (30 min)
2. **Revisa Agents.md** para los elementos de decisión (45 min)
3. **Estudia Skills.md** para operaciones (30 min)
4. **Profundiza Memory.md** para persistencia (60 min)
5. **Ejecuta mentalmente los ejemplos en RuntimeFlow.md** (90 min)
6. **Comienza implementación** desde Fase 1 del roadmap

---

## Contacto y Feedback

Para preguntas, sugerencias o actualizaciones sobre esta arquitectura:
- Revisar spec.md para contexto funcional original
- Consultar DEEP_WIKI.md para decisiones previas
- Mantener rubros sincronizados: Agents ↔ Skills ↔ Memory

---

**Versión**: 1.0  
**Fecha**: 8 de abril de 2026  
**Status**: ✓ Especificación Completa, Listo para Implementación

