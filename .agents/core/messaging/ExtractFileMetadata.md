## 3. ExtractFileMetadata Skill

### Nombre
**ExtractFileMetadata**

### Descripción
Parsear información de archivo: URL, nombre, extensión, tipo MIME, tamaño.

### Tipo
Functional

### Inputs
```json
{
  "file_object": {
    "url": "string",
    "name": "string",
    "ext": "string"
  },
  "allowed_extensions": ["pdf", "jpg", "png"],
  "max_size_mb": "int"
}
```

### Outputs
```json
{
  "valid": true|false,
  "metadata": {
    "file_name": "string",
    "extension": "string",
    "mime_type": "string",
    "size_mb": "float",
    "file_id": "uuid"
  },
  "errors": ["error1"]
}
```

### Reglas de Ejecución

```
1. Validar URL formato (http/https)
2. Extraer extension del URL O del campo "ext"
3. IF extension NOT in allowed_extensions
   THEN valid = false, append error
4. Detectar MIME type desde extension
5. Validar tamaño (si disponible)
6. Generar file_id único
```

### Casos de Uso

- Ingesta de archivos en webhook
- Validación de upload de usuario
- Preparación para referenciación

### Ejemplo Práctico

**Input:**
```json
{
  "file_object": {
    "url": "https://storage.com/documento.pdf",
    "name": "documento",
    "ext": "pdf"
  },
  "allowed_extensions": ["pdf", "docx", "jpg"],
  "max_size_mb": 50
}
```

**Output:**
```json
{
  "valid": true,
  "metadata": {
    "file_name": "documento.pdf",
    "extension": "pdf",
    "mime_type": "application/pdf",
    "size_mb": 2.5,
    "file_id": "uuid-file-1"
  },
  "errors": []
}
```

### Dependencias
Ninguna (pura)