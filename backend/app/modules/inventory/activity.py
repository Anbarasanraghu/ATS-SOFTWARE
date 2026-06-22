"""Activity logging for the inventory module.

Every create / update / delete / stock movement is recorded in activity_log so
the Updates page can render a recent-activity feed and per-day change counts.

The log row is just added to the session and flushed with the request's main
transaction — no SAVEPOINT — so auditing costs zero extra DB round trips.
(The activity_log table is created by migration 009; it must be applied.)
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ActivityLog


async def log_activity(
    session: AsyncSession,
    user,
    *,
    entity: str,
    action: str,
    entity_id=None,
    entity_name: str | None = None,
    detail: dict | None = None,
) -> None:
    session.add(ActivityLog(
        tenant_id=user.tenant_id,
        entity=entity,
        entity_id=entity_id,
        entity_name=entity_name,
        action=action,
        detail=detail or {},
        created_by=user.id,
    ))


def diff_fields(before: dict, after: dict) -> dict:
    """Return {field: {"from": old, "to": new}} for values that changed."""
    changes: dict = {}
    for key, new_val in after.items():
        old_val = before.get(key)
        if old_val != new_val:
            changes[key] = {"from": old_val, "to": new_val}
    return changes
