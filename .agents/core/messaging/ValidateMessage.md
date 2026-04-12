## 2. ValidateMessage Skill

### Nombre
**ValidateMessage**

### Descripción
Validar contenido, longitud, caracteres especiales y conformidad con reglas de negocio.

### Tipo
Functional

### Inputs
```json
{
  "message": "string",
  "message_type": "text|quick_answer|command",
  "constraints": {
    "min_length": "int",
    "max_length": "int",
    "allow_html": "boolean",
    "allow_urls": "boolean"
  }
}
```

### Outputs
```json
{
  "valid": true|false,
  "message_sanitized": "string",
  "violations": ["violation1", "violation2"],
  "score": "float (0-1)"
}
```

### Reglas de Ejecución

```
1. Verificar longitud: length >= min_length AND <= max_length
2. Detectar caracteres inválidos (especiales, control, etc.)
3. IF allow_html == false: detectar y rechazar tags
4. IF allow_urls == false: detectar y rechazar URLs
5. Verificar ratio de spam (palabras repetidas, símbolos)
6. Truncar o rechazar según policies
7. Calcular "score" de calidad
```

### Casos de Uso

- Validación de mensaje previo a envío
- Prevención de inyección
- Filtrado de spam
- Validación de quick answers dinámicos

### Ejemplo Práctico

**Input:**
```json
{
  "message": "Hola, ¿cómo estás?",
  "message_type": "text",
  "constraints": {
    "min_length": 1,
    "max_length": 1000,
    "allow_html": false,
    "allow_urls": true
  }
}
```

**Output:**
```json
{
  "valid": true,
  "message_sanitized": "Hola, ¿cómo estás?",
  "violations": [],
  "score": 0.95
}
```

### Dependencias
Ninguna (pura)