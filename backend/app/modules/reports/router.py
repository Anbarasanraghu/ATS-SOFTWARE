from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select, text

from app.auth.deps import get_request_context
from app.db.models import Customer, Invoice, Product

router = APIRouter()


@router.get("/summary")
async def get_summary(ctx=Depends(get_request_context)):
    session = ctx["session"]

    inv_stats = (await session.execute(
        select(
            func.count(Invoice.id).label("total"),
            func.sum(case((Invoice.status == "draft", 1), else_=0)).label("draft"),
            func.sum(case((Invoice.status == "sent",  1), else_=0)).label("sent"),
            func.sum(case((Invoice.status == "paid",  1), else_=0)).label("paid"),
            func.sum(case((Invoice.status == "void",  1), else_=0)).label("void"),
            func.coalesce(
                func.sum(case((Invoice.status == "paid", Invoice.total), else_=None)), 0
            ).label("revenue"),
            func.coalesce(
                func.sum(case((Invoice.status.in_(["draft", "sent"]), Invoice.total), else_=None)), 0
            ).label("outstanding"),
        ).select_from(Invoice)
    )).one()

    customer_count = (await session.execute(
        select(func.count(Customer.id)).select_from(Customer)
    )).scalar_one()

    product_count = (await session.execute(
        select(func.count(Product.id)).select_from(Product)
    )).scalar_one()

    recent_invoices = (await session.execute(
        select(Invoice).order_by(Invoice.created_at.desc()).limit(5)
    )).scalars().all()

    top_customers_rows = (await session.execute(
        select(Invoice.customer_name, func.sum(Invoice.total).label("total"))
        .select_from(Invoice)
        .where(Invoice.status == "paid")
        .group_by(Invoice.customer_name)
        .order_by(func.sum(Invoice.total).desc())
        .limit(5)
    )).all()

    return {
        "invoices": {
            "total": inv_stats.total or 0,
            "draft": inv_stats.draft or 0,
            "sent":  inv_stats.sent  or 0,
            "paid":  inv_stats.paid  or 0,
            "void":  inv_stats.void  or 0,
        },
        "revenue":        float(inv_stats.revenue      or 0),
        "outstanding":    float(inv_stats.outstanding  or 0),
        "customer_count": customer_count,
        "product_count":  product_count,
        "recent_invoices": [
            {
                "id":             str(inv.id),
                "invoice_number": inv.invoice_number,
                "customer_name":  inv.customer_name,
                "total":          float(inv.total),
                "status":         inv.status,
                "issue_date":     inv.issue_date.isoformat() if inv.issue_date else None,
            }
            for inv in recent_invoices
        ],
        "top_customers": [
            {"name": row.customer_name, "total": float(row.total)}
            for row in top_customers_rows
        ],
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
