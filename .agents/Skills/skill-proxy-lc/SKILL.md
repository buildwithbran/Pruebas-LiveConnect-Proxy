---
name: skill-proxy-lc
description: |
  - Capa intermedia que permite interceptar, procesar y gestionar mensajes entrantes y salientes en múltiples canales (WhatsApp, Web, Instagram, etc.).
  - Utiliza un webhook personalizado para habilitar automatización.
  - Permite integración con sistemas externos.
  - Ofrece control total del flujo conversacional.
version: 1.0.0  
---

## ⚡ Capacidades

El sistema basado en el Proxy de LiveConnect permite:

- Interceptar mensajes antes de llegar a la plataforma principal  
- Procesar mensajes en tiempo real mediante webhooks  
- Enviar mensajes de texto, archivos y respuestas rápidas  
- Transferir conversaciones a agentes humanos  
- Gestionar configuración de webhooks por canal  
- Consultar estado operativo del proxy  
- Integrarse con sistemas externos (CRM, IA, APIs)  
- Construir interfaces personalizadas tipo inbox  

---

## 🧠 Habilidades

### 📩 Gestión de Mensajes

- **Enviar mensajes de texto**
  - Endpoint: `/proxy/sendMessage`
  - Parámetros: `id_conversacion`, `mensaje`

- **Enviar archivos**
  - Endpoint: `/proxy/sendFile`
  - Parámetros:
    - `id_conversacion`
    - `url`
    - `nombre`
    - `extension`

- **Enviar respuestas rápidas (QuickAnswer)**
  - Endpoint: `/proxy/sendQuickAnswer`
  - Parámetros:
    - `id_conversacion`
    - `id_respuesta`
    - `variables`

---

### 🔁 Gestión de Conversaciones

- **Transferir conversación a LiveConnect**
  - Endpoint: `/proxy/transfer`
  - Permite:
    - Asignar agente
    - Asignar grupo
    - Inyectar contexto inicial  

---

### 🔗 Configuración del Proxy

- **Configurar webhook**
  - Endpoint: `/proxy/setWebhook`
  - Parámetros:
    - `id_canal`
    - `estado`
    - `url`
    - `secret`

- **Consultar estado del webhook**
  - Endpoint: `/proxy/getWebhook`

---

### 📊 Monitoreo

- **Consultar balance**
  - Endpoint: `/proxy/balance`

---

### 🧾 Procesamiento de Webhook

Ejemplo de payload:

```json
{
  "id_conversacion": "string",
  "message": {
    "texto": "string",
    "file": {
      "url": "string",
      "nombre": "string",
      "extension": "string"
    }
  },
  "contact_data": {
    "name": "string"
  }
}
```
# Skills Index

## Proxy LiveConnect
- sendMessage
- sendFile
- transfer
- getWebhook
- setWebhook
- balance

Use this skill when interacting with LiveConnect API.

(see /core/skills-engine)