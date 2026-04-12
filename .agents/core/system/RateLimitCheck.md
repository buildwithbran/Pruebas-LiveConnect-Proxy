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