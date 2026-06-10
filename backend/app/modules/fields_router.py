from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.auth.deps import get_request_context
from app.db.models import FieldDefinition

router = APIRouter()


@router.get("/field-definitions")
async def list_field_definitions(entity: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    rows = (
        await session.execute(
            select(FieldDefinition)
            .where(FieldDefinition.entity == entity)
            .order_by(FieldDefinition.sort_order)
        )
    ).scalars().all()
    return [
        {
            "field_key": d.field_key,
            "label": d.label,
            "data_type": d.data_type,
            "is_required": d.is_required,
            "options": d.options,
            "sort_order": d.sort_order,
        }
        for d in rows
    ]