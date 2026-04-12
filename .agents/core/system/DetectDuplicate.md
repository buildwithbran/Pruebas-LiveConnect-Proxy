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