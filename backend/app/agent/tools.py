"""
Tool implementations for the AI agent.

Each function is registered via @tool and runs against the per-request,
tenant-scoped AsyncSession in ``ctx["session"]`` — PostgreSQL RLS keeps every
query inside the caller's tenant automatically, so no handler filters by
tenant_id itself. Queries are parameterized; the LLM supplies only the values.

Importing this module is what populates the REGISTRY, so the router imports it
once at startup.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import text

from app.agent.registry import tool


# ── helpers ──────────────────────────────────────────────────

def _f(v: Any) -> float:
    return float(v) if v is not None else 0.0


def _to_date(s: str | None) -> date | None:
    """Parse a YYYY-MM-DD string into a date. asyncpg requires a real date
    object for DATE columns — a string (even cast in SQL) fails to encode."""
    if not s:
        return None
    try:
        return date.fromisoformat(str(s).strip()[:10])
    except ValueError:
        return None


async def _rows(ctx, sql: str, params: dict | None = None) -> list[dict]:
    res = await ctx["session"].execute(text(sql), params or {})
    return [dict(r._mapping) for r in res]


async def _one(ctx, sql: str, params: dict | None = None) -> dict | None:
    res = await ctx["session"].execute(text(sql), params or {})
    row = res.first()
    return dict(row._mapping) if row else None


# ════════════════════════════════════════════════════════════
#  DASHBOARD / REPORTS
# ════════════════════════════════════════════════════════════

@tool(
    name="get_dashboard_summary",
    description="High-level business snapshot: invoice counts by status, total paid revenue, outstanding (unpaid) amount, and customer/product counts.",
    category="dashboard",
)
async def get_dashboard_summary(ctx) -> dict:
    r = await _one(ctx, """
        select
          count(*)                                               as total_invoices,
          count(*) filter (where status='paid')                  as paid_invoices,
          count(*) filter (where status in ('draft','sent'))     as unpaid_invoices,
          coalesce(sum(total) filter (where status='paid'), 0)   as revenue,
          coalesce(sum(total - amount_paid) filter (where status in ('draft','sent')), 0) as outstanding,
          (select count(*) from customers) as customers,
          (select count(*) from products)  as products
        from invoices
    """)
    r = r or {}
    return {
        "total_invoices": r.get("total_invoices", 0),
        "paid_invoices": r.get("paid_invoices", 0),
        "unpaid_invoices": r.get("unpaid_invoices", 0),
        "revenue": _f(r.get("revenue")),
        "outstanding": _f(r.get("outstanding")),
        "customers": r.get("customers", 0),
        "products": r.get("products", 0),
    }


@tool(
    name="get_today_sales",
    description="Total sales billed today: number of invoices issued today and their combined value.",
    category="reports",
)
async def get_today_sales(ctx) -> dict:
    r = await _one(ctx, """
        select count(*) as count, coalesce(sum(total), 0) as total,
               coalesce(sum(amount_paid), 0) as collected
        from invoices
        where issue_date = current_date and status <> 'void'
    """)
    r = r or {}
    return {
        "date": date.today().isoformat(),
        "invoice_count": r.get("count", 0),
        "total_billed": _f(r.get("total")),
        "amount_collected": _f(r.get("collected")),
    }


@tool(
    name="generate_sales_report",
    description="Sales report for a date range. Returns totals and a per-month breakdown of billed and collected amounts.",
    parameters={
        "type": "object",
        "properties": {
            "start_date": {"type": "string", "description": "Inclusive start date, YYYY-MM-DD."},
            "end_date": {"type": "string", "description": "Inclusive end date, YYYY-MM-DD."},
        },
        "required": ["start_date", "end_date"],
    },
    category="reports",
)
async def generate_sales_report(ctx, start_date: str, end_date: str) -> dict:
    sd, ed = _to_date(start_date), _to_date(end_date)
    if not sd or not ed:
        return {"error": "start_date and end_date must be valid dates in YYYY-MM-DD format."}
    params = {"s": sd, "e": ed}
    totals = await _one(ctx, """
        select count(*) as count,
               coalesce(sum(total), 0) as billed,
               coalesce(sum(amount_paid), 0) as collected,
               coalesce(sum(total - amount_paid), 0) as outstanding
        from invoices
        where status <> 'void' and issue_date between cast(:s as date) and cast(:e as date)
    """, params)
    by_month = await _rows(ctx, """
        select to_char(issue_date, 'YYYY-MM') as month,
               count(*) as count,
               coalesce(sum(total), 0) as billed
        from invoices
        where status <> 'void' and issue_date between cast(:s as date) and cast(:e as date)
        group by 1 order by 1
    """, params)
    totals = totals or {}
    return {
        "start_date": start_date,
        "end_date": end_date,
        "invoice_count": totals.get("count", 0),
        "total_billed": _f(totals.get("billed")),
        "total_collected": _f(totals.get("collected")),
        "outstanding": _f(totals.get("outstanding")),
        "by_month": [
            {"month": m["month"], "count": m["count"], "billed": _f(m["billed"])}
            for m in by_month
        ],
    }


@tool(
    name="get_report_list",
    description="List the report types this assistant can generate, so the user knows what to ask for.",
    category="reports",
)
async def get_report_list(ctx) -> dict:
    return {
        "reports": [
            {"key": "sales", "name": "Sales report", "needs": "start_date, end_date"},
            {"key": "today_sales", "name": "Today's sales", "needs": "none"},
            {"key": "cash_flow", "name": "Cash flow (revenue vs outstanding)", "needs": "none"},
            {"key": "low_stock", "name": "Low stock products", "needs": "none"},
            {"key": "inventory_status", "name": "Inventory status", "needs": "none"},
            {"key": "pending_tasks", "name": "Pending follow-ups & expiring stock", "needs": "none"},
        ]
    }


@tool(
    name="get_cash_flow",
    description="Cash position: total collected revenue vs outstanding receivables, plus what was collected this calendar month.",
    category="finance",
)
async def get_cash_flow(ctx) -> dict:
    r = await _one(ctx, """
        select
          coalesce(sum(amount_paid), 0) as collected_all,
          coalesce(sum(total - amount_paid) filter (where status in ('draft','sent')), 0) as outstanding,
          coalesce(sum(amount_paid) filter (where date_trunc('month', issue_date) = date_trunc('month', current_date)), 0) as collected_this_month
        from invoices where status <> 'void'
    """)
    r = r or {}
    return {
        "collected_total": _f(r.get("collected_all")),
        "outstanding": _f(r.get("outstanding")),
        "collected_this_month": _f(r.get("collected_this_month")),
    }


# ════════════════════════════════════════════════════════════
#  CRM
# ════════════════════════════════════════════════════════════

@tool(
    name="get_customer_list",
    description="List customers (most recent first). Useful for an overview of the customer base.",
    parameters={
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "description": "Max rows to return (default 20, max 100)."},
        },
    },
    category="crm",
)
async def get_customer_list(ctx, limit: int = 20) -> dict:
    limit = max(1, min(int(limit or 20), 100))
    rows = await _rows(ctx, """
        select name, phone, email, company, crm_status, payment_status,
               to_char(next_followup_date, 'YYYY-MM-DD') as next_followup
        from customers order by created_at desc limit :lim
    """, {"lim": limit})
    return {"count": len(rows), "customers": rows}


@tool(
    name="search_customer",
    description="Find customers matching a name, phone number, email or company. Case-insensitive partial match.",
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Text to search for in customer name/phone/email/company."},
        },
        "required": ["query"],
    },
    category="crm",
)
async def search_customer(ctx, query: str) -> dict:
    rows = await _rows(ctx, """
        select name, phone, email, company, crm_status, payment_status,
               to_char(next_followup_date, 'YYYY-MM-DD') as next_followup
        from customers
        where name ilike :q or coalesce(phone,'') ilike :q
           or coalesce(email,'') ilike :q or coalesce(company,'') ilike :q
        order by created_at desc limit 25
    """, {"q": f"%{query}%"})
    return {"query": query, "count": len(rows), "matches": rows}


@tool(
    name="get_pending_tasks",
    description="Things needing attention soon: customer follow-ups due within the next 7 days, plus stock batches expiring within 30 days.",
    category="crm",
)
async def get_pending_tasks(ctx) -> dict:
    followups = await _rows(ctx, """
        select name, phone, crm_status,
               to_char(next_followup_date, 'YYYY-MM-DD') as due
        from customers
        where next_followup_date is not null
          and next_followup_date <= current_date + 7
        order by next_followup_date limit 25
    """)
    expiring = await _rows(ctx, """
        select b.batch_no, p.name as product,
               to_char(b.expiry_date, 'YYYY-MM-DD') as expiry, b.quantity
        from product_batches b join products p on p.id = b.product_id
        where b.expiry_date is not null
          and b.expiry_date <= current_date + 30
          and b.quantity > 0
        order by b.expiry_date limit 25
    """)
    return {
        "followups_due": [
            {"customer": f["name"], "phone": f["phone"],
             "status": f["crm_status"], "due": f["due"]}
            for f in followups
        ],
        "expiring_batches": [
            {"product": e["product"], "batch_no": e["batch_no"],
             "expiry": e["expiry"], "quantity": _f(e["quantity"])}
            for e in expiring
        ],
    }


# ════════════════════════════════════════════════════════════
#  INVENTORY
# ════════════════════════════════════════════════════════════

@tool(
    name="get_inventory_status",
    description="Inventory overview: number of products, total stock units, total stock value (at cost and at selling price), and how many products are at/below reorder level.",
    category="inventory",
)
async def get_inventory_status(ctx) -> dict:
    r = await _one(ctx, """
        select
          count(*) as products,
          coalesce(sum(stock_qty), 0) as total_units,
          coalesce(sum(stock_qty * cost_price), 0) as stock_value_cost,
          coalesce(sum(stock_qty * price), 0) as stock_value_retail,
          count(*) filter (where stock_qty <= reorder_level) as low_stock_count
        from products where coalesce(is_active, true)
    """)
    r = r or {}
    return {
        "products": r.get("products", 0),
        "total_units": _f(r.get("total_units")),
        "stock_value_cost": _f(r.get("stock_value_cost")),
        "stock_value_retail": _f(r.get("stock_value_retail")),
        "low_stock_count": r.get("low_stock_count", 0),
    }


@tool(
    name="get_low_stock_products",
    description="Products at or below their reorder level — i.e. items that should be restocked.",
    parameters={
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "description": "Max rows (default 25, max 100)."},
        },
    },
    category="inventory",
)
async def get_low_stock_products(ctx, limit: int = 25) -> dict:
    limit = max(1, min(int(limit or 25), 100))
    rows = await _rows(ctx, """
        select name, sku, stock_qty, reorder_level
        from products
        where coalesce(is_active, true) and stock_qty <= reorder_level
        order by (reorder_level - stock_qty) desc limit :lim
    """, {"lim": limit})
    return {
        "count": len(rows),
        "products": [
            {"name": p["name"], "sku": p["sku"],
             "stock_qty": _f(p["stock_qty"]), "reorder_level": _f(p["reorder_level"])}
            for p in rows
        ],
    }


@tool(
    name="predict_stock_requirement",
    description="Estimate how much of a product to reorder, based on its average daily outflow over the last 30 days versus current stock. Identify the product by name or SKU.",
    parameters={
        "type": "object",
        "properties": {
            "product": {"type": "string", "description": "Product name or SKU."},
            "cover_days": {"type": "integer", "description": "How many days of stock to keep on hand (default 30)."},
        },
        "required": ["product"],
    },
    category="inventory",
)
async def predict_stock_requirement(ctx, product: str, cover_days: int = 30) -> dict:
    cover_days = max(1, min(int(cover_days or 30), 365))
    p = await _one(ctx, """
        select id, name, sku, stock_qty, reorder_level
        from products
        where name ilike :q or coalesce(sku,'') ilike :q
        order by (name ilike :exact) desc limit 1
    """, {"q": f"%{product}%", "exact": product})
    if not p:
        return {"found": False, "message": f"No product matching '{product}'."}

    out = await _one(ctx, """
        select coalesce(sum(quantity), 0) as out_qty
        from stock_movements
        where product_id = :pid and movement_type = 'out'
          and created_at >= current_date - 30
    """, {"pid": str(p["id"])})
    out_30 = _f((out or {}).get("out_qty"))
    avg_daily = out_30 / 30.0
    projected_need = avg_daily * cover_days
    current = _f(p["stock_qty"])
    suggested = max(0.0, round(projected_need - current, 2))
    return {
        "found": True,
        "product": p["name"],
        "sku": p["sku"],
        "current_stock": current,
        "avg_daily_outflow": round(avg_daily, 3),
        "cover_days": cover_days,
        "projected_need": round(projected_need, 2),
        "suggested_reorder_qty": suggested,
    }


# ════════════════════════════════════════════════════════════
#  BILLING
# ════════════════════════════════════════════════════════════

@tool(
    name="get_invoice",
    description="Look up a single invoice by its invoice number, with status, totals and line items.",
    parameters={
        "type": "object",
        "properties": {
            "invoice_number": {"type": "string", "description": "The invoice number to look up."},
        },
        "required": ["invoice_number"],
    },
    category="billing",
)
async def get_invoice(ctx, invoice_number: str) -> dict:
    inv = await _one(ctx, """
        select id, invoice_number, customer_name, status,
               to_char(issue_date, 'YYYY-MM-DD') as issue_date,
               subtotal, tax_total, total, amount_paid
        from invoices where invoice_number = :n limit 1
    """, {"n": invoice_number})
    if not inv:
        return {"found": False, "message": f"No invoice numbered '{invoice_number}'."}
    items = await _rows(ctx, """
        select description, quantity, unit_price, line_total
        from invoice_items where invoice_id = :iid order by id
    """, {"iid": str(inv["id"])})
    return {
        "found": True,
        "invoice_number": inv["invoice_number"],
        "customer_name": inv["customer_name"],
        "status": inv["status"],
        "issue_date": inv["issue_date"],
        "subtotal": _f(inv["subtotal"]),
        "tax_total": _f(inv["tax_total"]),
        "total": _f(inv["total"]),
        "amount_paid": _f(inv["amount_paid"]),
        "balance_due": _f(inv["total"]) - _f(inv["amount_paid"]),
        "items": [
            {"description": i["description"], "quantity": _f(i["quantity"]),
             "unit_price": _f(i["unit_price"]), "line_total": _f(i["line_total"])}
            for i in items
        ],
    }


# ════════════════════════════════════════════════════════════
#  HR
# ════════════════════════════════════════════════════════════

@tool(
    name="get_employee_list",
    description="List employees with their job title, department and status.",
    parameters={
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "description": "Max rows (default 25, max 100)."},
        },
    },
    category="hr",
    roles={"owner", "admin", "manager"},
)
async def get_employee_list(ctx, limit: int = 25) -> dict:
    limit = max(1, min(int(limit or 25), 100))
    rows = await _rows(ctx, """
        select full_name, employee_no, job_title, department, status
        from employees order by created_at desc limit :lim
    """, {"lim": limit})
    return {"count": len(rows), "employees": rows}


# ════════════════════════════════════════════════════════════
#  WRITE TOOLS (destructive → require explicit confirmation)
# ════════════════════════════════════════════════════════════

@tool(
    name="create_customer",
    description="Create a new customer/lead record. This writes data, so it must be confirmed by the user before running.",
    parameters={
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Customer or company contact name (required)."},
            "phone": {"type": "string", "description": "Phone number."},
            "email": {"type": "string", "description": "Email address."},
            "company": {"type": "string", "description": "Company name."},
        },
        "required": ["name"],
    },
    category="crm",
    destructive=True,
)
async def create_customer(ctx, name: str, phone: str | None = None,
                          email: str | None = None, company: str | None = None) -> dict:
    user = ctx["user"]
    row = await _one(ctx, """
        insert into customers (tenant_id, name, phone, email, company, created_by)
        values (current_tenant_id(), :name, :phone, :email, :company, :uid)
        returning id, name
    """, {"name": name, "phone": phone, "email": email, "company": company,
          "uid": str(user.id)})
    return {"created": True, "id": str(row["id"]), "name": row["name"]}


@tool(
    name="record_customer_followup",
    description="Add a follow-up note for a customer and set their next follow-up date. Writes data; must be confirmed first. Identify the customer by name or phone.",
    parameters={
        "type": "object",
        "properties": {
            "customer": {"type": "string", "description": "Customer name or phone to match."},
            "note": {"type": "string", "description": "Follow-up note / what was discussed."},
            "next_followup_date": {"type": "string", "description": "Next follow-up date, YYYY-MM-DD (optional)."},
        },
        "required": ["customer", "note"],
    },
    category="crm",
    destructive=True,
)
async def record_customer_followup(ctx, customer: str, note: str,
                                   next_followup_date: str | None = None) -> dict:
    cust = await _one(ctx, """
        select id, name from customers
        where name ilike :q or coalesce(phone,'') ilike :q
        order by created_at desc limit 1
    """, {"q": f"%{customer}%"})
    if not cust:
        return {"created": False, "message": f"No customer matching '{customer}'."}
    user = ctx["user"]
    await ctx["session"].execute(text("""
        insert into interactions (tenant_id, customer_id, type, subject, body, created_by)
        values (current_tenant_id(), :cid, 'note', 'Follow-up', :body, :uid)
    """), {"cid": str(cust["id"]), "body": note, "uid": str(user.id)})
    nfd = _to_date(next_followup_date)
    if nfd:
        await ctx["session"].execute(text("""
            update customers
            set next_followup_date = :d, last_followup_date = current_date
            where id = :cid
        """), {"d": nfd, "cid": str(cust["id"])})
    return {"created": True, "customer": cust["name"],
            "next_followup_date": nfd.isoformat() if nfd else None}
