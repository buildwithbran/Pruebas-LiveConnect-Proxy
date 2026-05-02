from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class NormalizedIncomingMessage:
    conversation_id: str
    canal: str
    message_text: str
    message_type: str
    file: dict[str, Any] | None = None
    contact_name: str | None = None
    celular: int | None = None
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class ProviderResult:
    ok: bool
    status_code: int
    payload: Any = None
    error: str | None = None
    warnings: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {}

        if isinstance(self.payload, dict):
            result.update(self.payload)
        elif self.payload is not None:
            result["data"] = self.payload

        result.setdefault("ok", self.ok)
        result["status_code"] = self.status_code

        if self.error and "error" not in result:
            result["error"] = self.error

        if self.warnings:
            existing_warnings = result.get("warnings")
            if isinstance(existing_warnings, list):
                warnings = list(existing_warnings)
            else:
                warnings = []

            for warning in self.warnings:
                if warning not in warnings:
                    warnings.append(warning)

            result["warnings"] = warnings

        return result


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    ignored: bool = False
    warning: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class RouteCommand:
    name: str
    handler: Callable[..., dict[str, Any]]

    def execute(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return self.handler(*args, **kwargs)
