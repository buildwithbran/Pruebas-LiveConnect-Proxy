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