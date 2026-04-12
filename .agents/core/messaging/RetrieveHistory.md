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