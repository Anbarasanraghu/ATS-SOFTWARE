import json

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text

from app.auth.deps import get_request_context
from app.db.models import Invoice

router = APIRouter()

# Whole dashboard summary in ONE round trip: invoice aggregates, customer/product
# counts, and the recent-invoice + top-customer lists (as JSON). RLS keeps every
# reference tenant-scoped via the tenant context set on the request.
_SUMMARY_SQL = text("""
with inv as (
  select
    count(*)                                              as total,
    count(*) filter (where status='draft')                as draft,
    count(*) filter (where status='sent')                 as sent,
    count(*) filter (where status='paid')                 as paid,
    count(*) filter (where status='void')                 as void,
    coalesce(sum(total) filter (where status='paid'), 0)  as revenue,
    coalesce(sum(total) filter (where status in ('draft','sent')), 0) as outstanding
  from invoices
)
select
  inv.total, inv.draft, inv.sent, inv.paid, inv.void, inv.revenue, inv.outstanding,
  (select count(*) from customers) as customer_count,
  (select count(*) from products)  as product_count,
  coalesce((select json_agg(r) from (
      select id, invoice_number, customer_name, total, status,
             to_char(issue_date, 'YYYY-MM-DD') as issue_date
      from invoices order by created_at desc limit 5) r), '[]') as recent_invoices,
  coalesce((select json_agg(t) from (
      select customer_name as name, sum(total) as total
      from invoices where status='paid'
      group by customer_name order by sum(total) desc limit 5) t), '[]') as top_customers
from inv
""")


def _as_list(v):
    return json.loads(v) if isinstance(v, str) else (v or [])


@router.get("/summary")
async def get_summary(ctx=Depends(get_request_context)):
    r = (await ctx["session"].execute(_SUMMARY_SQL)).one()
    recent = _as_list(r.recent_invoices)
    for it in recent:
        it["id"] = str(it["id"])
        it["total"] = float(it["total"])
    top = [{"name": t["name"], "total": float(t["total"])} for t in _as_list(r.top_customers)]
    return {
        "invoices": {
            "total": r.total or 0, "draft": r.draft or 0, "sent": r.sent or 0,
            "paid": r.paid or 0, "void": r.void or 0,
        },
        "revenue":        float(r.revenue or 0),
        "outstanding":    float(r.outstanding or 0),
        "customer_count": r.customer_count or 0,
        "product_count":  r.product_count or 0,
        "recent_invoices": recent,
        "top_customers":   top,
    }


@router.get("/invoices-by-month")
async def invoices_by_month(ctx=Depends(get_request_context)):
    session = ctx["session"]
    month_col = func.to_char(Invoice.issue_date, text("'YYYY-MM'"))
    rows = (await session.execute(
        select(
            month_col.label("month"),
            func.count(Invoice.id).label("count"),
            func.coalesce(func.sum(Invoice.total), 0).label("total"),
        )
        .select_from(Invoice)
        .where(Invoice.status != "void")
        .group_by(month_col)
        .order_by(month_col)
        .limit(12)
    )).all()
    return [{"month": r.month, "count": r.count, "total": float(r.total)} for r in rows]
