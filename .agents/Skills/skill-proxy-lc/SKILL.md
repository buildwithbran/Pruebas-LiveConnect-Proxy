---
name: skill-proxy-lc
description: Surface AI minima para el proxy LiveConnect. Usa Agents.md como indice y carga solo el skill o agente requerido.
version: 1.1.0
---

## Cuando usar

- Webhooks entrantes de LiveConnect.
- Envio de mensajes, archivos y quick answers.
- Configuracion de webhook, balance y canales.
- Consultas sobre la arquitectura AI-first del proxy.

## Skills disponibles

- `parse-payload`
- `validate-message`
- `store-message`
- `send-message`
- `send-file`
- `send-quick-answer`
- `transfer`
- `set-webhook`
- `get-webhook`
- `get-balance`
- `get-channels`

## Contratos minimos

- Webhook normalizado:
```json
{
  "conversation_id": "string",
  "canal": "string",
  "message_text": "string",
  "message_type": "text|file|link|structured",
  "file": {"url": "string", "name": "string", "ext": "string"} | null,
  "contact_name": "string | null",
  "metadata": {}
}
```

- Resultado proveedor:
```json
{
  "ok": true,
  "status_code": 200,
  "error": "string | optional",
  "warnings": ["string"],
  "data": {}
}
```

## Referencias

- `/Agents.md`
- `/.agents/docs/Architecture.md`
- `/.agents/docs/SkillsIndex.md`
