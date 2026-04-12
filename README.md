# Pruebas-LiveConnect-Proxy

Repositorio interno para probar el proxy de LiveConnect y su inbox web local.

## Arquitectura actual

- `Agents.md`: indice AI-first para Codex.
- `.agents/`: skills, docs minimas y fichas de agentes.
- `Pruebas LC/Messaging_platform/`: runtime Flask, orquestadores `core/`, servicios atomicos y persistencia SQLite.

## Runtime principal

- Webhook entrante: `POST /webhook/liveconnect`
- Mensajeria outbound: `/sendMessage`, `/sendFile`, `/sendQuickAnswer`, `/transfer`
- Configuracion: `/setWebhook`, `/getWebhook`, `/balance`, `/config/*`

## Tests

Ejecutar desde `Pruebas LC/Messaging_platform`:

```bash
python3 -m unittest discover tests
```
