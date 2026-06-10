from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FieldDefinition


def _option_values(options) -> set[str]:
    values: set[str] = set()
    for o in options or []:
        values.add(str(o.get("value")) if isinstance(o, dict) else str(o))
    return values


def _coerce(d: FieldDefinition, value):
    t = d.data_type
    try:
        if t == "number":
            return float(value)
        if t == "boolean":
            return bool(value)
        if t == "date":
            return date.fromisoformat(str(value)).isoformat()
        if t == "select":
            if str(value) not in _option_values(d.options):
                raise ValueError
            return str(value)
        if t == "multiselect":
            allowed = _option_values(d.options)
            vals = value if isinstance(value, list) else [value]
            if any(str(v) not in allowed for v in vals):
                raise ValueError
            return [str(v) for v in vals]
        return str(value)  # text
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid value for '{d.label}'")


async def validate_custom_fields(session: AsyncSession, entity: str, payload: dict | None) -> dict:
    payload = payload or {}
    defs = (
        await session.execute(
            select(FieldDefinition).where(FieldDefinition.entity == entity).order_by(FieldDefinition.sort_order)
        )
    ).scalars().all()

    clean: dict = {}
    for d in defs:
        val = payload.get(d.field_key)
        missing = val is None or val == "" or val == []
        if d.is_required and missing:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"'{d.label}' is required")
        if not missing:
            clean[d.field_key] = _coerce(d, val)
    return clean