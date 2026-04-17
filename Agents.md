# Agentes

## MessageRouter
Clasifica la operación HTTP, resuelve capacidades y construye el contexto de ejecución.

**Responsabilidades**
- Identificar endpoint y tipo de operación
- Resolver capabilities vía `CapabilityResolver`
- Construir `ExecutionContext`
- Delegar al agente correspondiente

**Runtime**
Pruebas LC/Messaging_platform/core/message_router.py

---

## WebhookProcessor
Orquesta el procesamiento de eventos entrantes desde LiveConnect.

**Responsabilidades**
- Ejecutar pipeline event-driven de entrada
- Aplicar capacidades activas (proxy, resiliencia)
- Delegar en skills de webhook

**Flujo**
incoming.message.received  
→ parse-payload  
→ incoming.message.parsed  
→ validate-message  
→ incoming.message.validated  
→ store-message  

**Runtime**
Pruebas LC/Messaging_platform/core/webhook_processor.py

---

## OutboundMessageAgent
Gestiona todas las operaciones salientes hacia el proveedor.

**Responsabilidades**
- Ejecutar envío de mensajes y acciones
- Aplicar capacidades transversales (proxy, resiliencia, performance)
- Orquestar skills outbound

**Operaciones**
- sendMessage
- sendFile
- sendQuickAnswer
- transfer

**Runtime**
Pruebas LC/Messaging_platform/core/outbound_message_agent.py

---

## ConfigurationAgent
Gestiona configuración del canal y comunicación con el proveedor.

**Responsabilidades**
- Configuración de webhook
- Consulta de balance
- Gestión de canales

**Runtime**
Pruebas LC/Messaging_platform/core/configuration_agent.py

---

# Skills (Operativas)

## Webhook
- parse-payload → Normaliza payload entrante
- validate-message → Determina si se procesa
- store-message → Persiste en base de datos

## Outbound
- send-message → Envío de texto
- send-file → Envío de archivos
- send-quick-answer → Envío de opciones
- transfer → Transferencia de conversación

## Configuración
- set-webhook
- get-webhook
- get-balance
- get-channels

---

# Capabilities (Meta-Skills)

## skill-proxy-lc
Gateway de comunicación con LiveConnect.

**Funciones**
- Normalización inbound/outbound
- Ejecución de llamadas al proveedor
- Adaptación de payloads

---

## python-backend
Lógica de negocio.

**Funciones**
- Validaciones
- Transformaciones
- Reglas de dominio

---

## python-resilience
Gestión de fallos.

**Funciones**
- Retry automático
- Manejo de errores
- Control de timeouts

---

## web-perf
Optimización del sistema.

**Funciones**
- Reducción de payload
- Caching
- Mejora de rendimiento

---

## frontend-design
Construcción de respuestas UI.

**Funciones**
- Formato de quick answers
- Estructura de mensajes enriquecidos

---

# Capability Routing

## Reglas Globales

- Si hay integración con proveedor → skill-proxy-lc
- Si hay lógica de negocio → python-backend
- Si la operación es crítica → python-resilience
- Si hay volumen o latencia → web-perf
- Si hay salida visual → frontend-design

---

## Mapping por Endpoint

### POST /webhook/liveconnect
Capabilities:
- skill-proxy-lc
- python-backend
- python-resilience

Flujo:
Request  
→ MessageRouter  
→ CapabilityResolver  
→ WebhookProcessor  
→ Pipeline de eventos  

---

### POST /sendMessage | /sendFile | /sendQuickAnswer | /transfer
Capabilities:
- skill-proxy-lc
- python-backend
- python-resilience
- web-perf
- frontend-design (condicional)

Flujo:
Request  
→ MessageRouter  
→ CapabilityResolver  
→ OutboundMessageAgent  
→ Ejecución de skill outbound  
→ Proxy  

---

### POST /setWebhook | /getWebhook  
### GET /balance  
### GET /config/channels

Capabilities:
- skill-proxy-lc
- python-backend

Flujo:
Request  
→ MessageRouter  
→ CapabilityResolver  
→ ConfigurationAgent  
→ Proxy  

---

### GET /conversations  
### GET /messages/<conversation_id>

- Acceso directo a repository
- No activan capabilities

---

# Execution Context

Estructura estándar:

```json
{
  "route": "/sendMessage",
  "provider": "liveconnect",
  "capabilities": [
    "skill-proxy-lc",
    "python-backend",
    "python-resilience",
    "web-perf"
  ],
  "payload": {}
}