## 4. AuthenticateRequest Skill

### Nombre
**AuthenticateRequest**

### Descripción
Validar token, extender sesión si es necesario, retornar user context.

### Tipo
Memory-Read (híbrido)

### Inputs
```json
{
  "token": "string",
  "request_id": "uuid",
  "ip_address": "string"
}
```

### Outputs
```json
{
  "authenticated": true|false,
  "user_id": "string",
  "session_id": "string",
  "expires_at": "ISO8601",
  "reason": "string"
}
```

### Reglas de Ejecución

```
1. Buscar token en Engram (short-term cache)
   IF found AND not expired
   RETURN authenticated=true
   
2. IF not in cache
   Consultar long-term memory
   Verify token signature
   Update cache
   
3. IF expired
   IF refresh_token exists
   Generate new token
   ELSE
   Return authenticated=false
   
4. Log acceso para auditoría
```

### Casos de Uso

- Validación inicial de requests
- Extensión de sesión
- Prevención de token replay
- Auditoría de acceso

### Ejemplo Práctico

**Input:**
```json
{
  "token": "eyJhbGciOi...",
  "request_id": "req-uuid-123",
  "ip_address": "192.168.1.100"
}
```

**Output:**
```json
{
  "authenticated": true,
  "user_id": "user-123",
  "session_id": "sess-456",
  "expires_at": "2026-04-08T15:30:00Z",
  "reason": "Token valid"
}
```

### Dependencias
- Engram (lectura short/long-term memory)