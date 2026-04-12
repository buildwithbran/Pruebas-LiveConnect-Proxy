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