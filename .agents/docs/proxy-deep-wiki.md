# Proxy LiveConnect - Deep Wiki

## 1. Overview
Qué es el proxy

## 2. Arquitectura

Usuario → Canal → Proxy → Webhook → Backend → DB → UI

## 3. Flujo completo

- Recepción webhook
- Procesamiento
- Persistencia
- Respuesta

## 4. Modelo de datos

- message
- conversation
- file

## 5. Tipos de mensajes

- texto
- archivo
- quickAnswer

## 6. Integración con API

- sendMessage
- sendFile
- transfer
- getWebhook

## 7. Manejo de errores

- webhook inválido
- timeout
- provider error

## 8. Seguridad

- secret validation
- token

## 9. Performance

- caching
- retries