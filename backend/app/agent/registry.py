"""
Tool Registry — the single source of truth for every capability the AI agent
can invoke. The LLM only ever *reasons* and picks a tool + arguments; the
handler here is what actually runs (a parameterized query against the
tenant-scoped session). This enforces the architecture guide's rules:

  • LLM never touches the database directly.
  • Every capability is an explicit, audited tool.
  • Role-based access is checked before execution.
  • Destructive tools require explicit human confirmation.

Register a tool with the @tool decorator. Handlers are
``async def handler(ctx, **args) -> dict`` where ``ctx`` is the request
context dict ({"session", "user", "tenant_id"}).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

# A handler receives the request context and validated keyword args.
Handler = Callable[..., Awaitable[Any]]


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict          # JSON Schema (Gemini functionDeclaration "parameters")
    handler: Handler
    category: str = "general"
    roles: Optional[set[str]] = None      # None = any authenticated user
    destructive: bool = False             # writes/side-effects → needs confirmation

    def to_gemini_declaration(self) -> dict:
        decl = {"name": self.name, "description": self.description}
        # Gemini rejects an empty "properties" object; omit parameters entirely
        # when the tool takes none.
        if self.parameters.get("properties"):
            decl["parameters"] = self.parameters
        return decl

    def allowed_for(self, user) -> bool:
        if self.roles is None:
            return True
        return bool(getattr(user, "is_platform_admin", False)) or getattr(user, "role", None) in self.roles


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolSpec] = {}

    def register(self, spec: ToolSpec) -> None:
        if spec.name in self._tools:
            raise ValueError(f"Duplicate tool name: {spec.name}")
        self._tools[spec.name] = spec

    def get(self, name: str) -> Optional[ToolSpec]:
        return self._tools.get(name)

    def all(self) -> list[ToolSpec]:
        return list(self._tools.values())

    def available_for(self, user) -> list[ToolSpec]:
        return [t for t in self._tools.values() if t.allowed_for(user)]


REGISTRY = ToolRegistry()


def tool(
    *,
    name: str,
    description: str,
    parameters: Optional[dict] = None,
    category: str = "general",
    roles: Optional[set[str]] = None,
    destructive: bool = False,
):
    """Decorator that registers a coroutine as an agent tool."""
    def decorator(fn: Handler) -> Handler:
        REGISTRY.register(ToolSpec(
            name=name,
            description=description,
            parameters=parameters or {"type": "object", "properties": {}},
            handler=fn,
            category=category,
            roles=roles,
            destructive=destructive,
        ))
        return fn
    return decorator
