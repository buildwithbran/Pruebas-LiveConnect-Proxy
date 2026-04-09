# Spec Driven Development (SDD) — Pruebas-LiveConnect-Proxy

Fecha: 8 de abril de 2026

## Propósito

Este documento especifica el diseño, requisitos, interfaces y criterios de aceptación para la aplicación "Messaging_platform" contenida en este repositorio. Sirve como guía para el desarrollo, pruebas y validación (Spec Driven Development).

## Alcance

Cobertura: funcionalidad de mensajería entrante/saliente, manejo de webhooks, token de autenticación, envío de mensajes/archivos, y flujos básicos de transferencia.

El SDD cubre los componentes dentro de la carpeta `Pruebas LC/Messaging_platform` incluyendo endpoints, servicios internos, modelos de datos, contratos de error, requisitos no funcionales y pruebas requeridas.

## Visión general de la arquitectura

- Entrada HTTP: `App.py` (Flask/WSGI) expone rutas para webhook y operaciones cliente.
- Servicios: `services/webhook_service.py` contiene la lógica de procesamiento del webhook.
- Métodos/API internos: `metodos/` alberga operaciones: `Token`, `SendMessage`, `SendFile`, `Setwebhook`, `GetWebhook`, `Transfer`, `Channels`, `Balance`, `Webhook`.
- Persistencia/DB: `DB/database.py` para acceso a la base de datos (si aplica) — abstracción de repositorio.
- Plantillas y estáticos: `templates/index.html`, `static/` para interfaz simple.
- Tests: `tests/` contiene pruebas unitarias/integ.

## Requisitos funcionales

1. Autenticación y Token
   - RF-01: Generar/validar token mediante `Token`.
   - RF-02: Todas las rutas protegidas deben validar token y devolver 401 si inválido.

2. Webhook (recepción)
   - RF-03: Recibir notificaciones entrantes en el endpoint de webhook.
   - RF-04: Validar firma/estructura del payload.
   - RF-05: Encolar/procesar mensajes y persistir metadata de conversacion.

3. Envío de Mensajes
   - RF-06: Endpoint para enviar mensajes (texto, quick answers).
   - RF-07: Soportar envío de archivos mediante `SendFile`.
   - RF-08: Devuelve estado sincrónico (aceptado/rechazado) y un id de mensaje.

4. Gestión de Webhook (Set/Get)
   - RF-09: Registrar o actualizar URL de webhook mediante `Setwebhook`.
   - RF-10: Obtener la configuración actual con `GetWebhook`.

5. Transferencias y Canales
   - RF-11: Soportar operación `Transfer` para reencaminar conversaciones.
   - RF-12: Exponer `Channels` y `Balance` para recuperar información de canales y saldo.

6. Manejo de errores
   - RF-13: Respuestas uniformes en formato JSON: `{code, message, details?}`.

## Requisitos no funcionales

- RNF-01: Respuesta de endpoints < 500ms bajo condiciones normales.
- RNF-02: Nivel de log suficiente para auditoría (request id, timestamps).
- RNF-03: Seguridad: TLS obligatorio, validación de inputs y protección contra inyección.
- RNF-04: Escalabilidad: componentes desacoplados para permitir encolado asíncrono.
- RNF-05: Tests: cobertura mínima del 80% para módulos críticos (`metodos/`, `services/`).

## Contratos de API (principales)

Nota: ajustar rutas según `App.py`.

1) POST /webhook
   - Descripción: recibe eventos entrantes.
   - Request: JSON con campos `{event_type, conversation_id, message:{id, from, to, body, attachments?}, timestamp}`.
   - Response: 200 OK {status: "received"}

2) POST /send_message
   - Descripción: envía mensaje outbound.
   - Request: `{to, channel, body, type="text", metadata?}` con Header `Authorization: Bearer <token>`.
   - Response: 202 Accepted `{message_id, status:"queued"}` o 400/401/500.

3) POST /send_file
   - Descripción: envía archivo.
   - Request: multipart/form-data con `file`, `to`, `channel` y `metadata`.
   - Response: 202 Accepted `{message_id, status:"queued"}`.

4) POST /set_webhook
   - Descripción: registra URL de webhook.
   - Request: `{url, events[]}`.
   - Response: 200 OK `{status:"ok"}`.

5) GET /get_webhook
   - Response: 200 `{url, events[]}`.

6) POST /token
   - Descripción: obtener token (si aplica).
   - Request: credenciales.
   - Response: 200 `{token, expires_in}`.

## Modelos de datos (esquema simplificado)

- Conversation
  - id: string
  - participants: [string]
  - last_message_at: timestamp
  - metadata: object

- Message
  - id: string
  - conversation_id: string
  - from: string
  - to: string
  - body: string
  - attachments: [{type, url, name}]?
  - status: enum(queue|sent|delivered|failed)
  - timestamp: timestamp

## Flujos principales (secuencias)

1) Recepción de webhook
   - Provider -> POST /webhook -> Validar -> Encolar -> Persistir metadata -> Responder 200

2) Envío de mensaje
   - Cliente -> POST /send_message + Authorization -> Validar -> Llamar a `metodos/SendMessage` -> Enviar al proveedor -> Marcar estado -> Responder 202

3) Envío de archivo
   - Igual que envío de mensaje, con almacenamiento temporal de archivo y referencia en `attachments`.

## Manejo de errores y codigos

- 400: Bad Request — payload inválido
- 401: Unauthorized — token inválido
- 404: Not Found — recurso inexistente
- 422: Unprocessable Entity — validación de negocio
- 500: Internal Server Error — errores no esperados

Formato de respuesta de error:

```
{
  "code": "ERR_CODE",
  "message": "Descripción legible",
  "details": { ... }
}
```

## Seguridad

- TLS para todas las comunicaciones.
- Validación y saneamiento de inputs en todos los puntos.
- Limitación de rate en endpoints sensibles.
- Almacenamiento seguro de credenciales (no en repo).

## Logs y observabilidad

- Correlación por `request_id` para cada request entrante.
- Logs estructurados en formato JSON para ingestión por SIEM.
- Métricas: latencia, errores por endpoint, tasa de mensajes procesados.

## Pruebas y criterios de aceptación

- Unit tests: cubrir `metodos/` y `services/webhook_service.py`.
- Integration tests: simular webhook y verificar persistencia y respuesta.
- E2E: enviar mensaje y confirmar cambio de estado hasta `sent` o `delivered`.

Criterios de aceptación (ejemplos):
- CA-01: POST /webhook devuelve 200 en menos de 500ms para payload válido.
- CA-02: POST /send_message con token válido devuelve 202 y genera `message_id`.
- CA-03: Tests automáticos pasados en CI para pull-requests.

## Tareas de desarrollo (alta prioridad)

1. Implementar validaciones de token en middleware.
2. Establecer contrato de webhook y pruebas unitarias.
3. Implementar encolado asíncrono opcional para envío.
4. Añadir logging estructurado y request_id.
5. Escribir pruebas para `test_webhook_service.py` y `test_repository.py` según criterios.

## Documentación y mantenimiento

- Mantener `spec.md` actualizado con cambios de API.
- Documentar cambios breaking y versión en `CHANGELOG.md` si se añade.

---

Fin del SDD inicial. Ajustes posteriores pueden detallar esquemas JSON completos, ejemplos de payloads, y diagramas UML/sequence en archivos auxiliares si se requiere.
