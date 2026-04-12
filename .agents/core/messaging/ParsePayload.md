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