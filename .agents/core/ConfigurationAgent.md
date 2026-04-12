# ConfigurationAgent

## Rol

Agrupa las operaciones de configuracion y monitoreo del proxy.

## Runtime

- `Pruebas LC/Messaging_platform/core/configuration_agent.py`

## Inputs

- Payloads de webhook config y filtros de canales.

## Outputs

- `ProviderResult` serializado a JSON.

## Skills

- `set-webhook`
- `get-webhook`
- `get-balance`
- `get-channels`
