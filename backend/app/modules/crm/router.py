from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.auth.deps import get_request_context
from app.db.models import Customer, CustomerFollowup, CustomerPaymentFollowup, Interaction, Invoice
from app.modules.crm.schemas import CustomerIn, CustomerOut
from app.modules.custom_fields import validate_custom_fields

router = APIRouter()


def _to_out(c: Customer) -> CustomerOut:
    return CustomerOut(
        id=str(c.id),
        name=c.name,
        email=c.email,
        phone=c.phone,
        whatsapp=c.whatsapp,
        company=c.company,
        address=c.address,
        notes=c.notes,
        status=c.status or "active",
        crm_status=c.crm_status or "new_lead",
        priority=c.priority or "medium",
        source=c.source,
        interested_service=c.interested_service,
        requirement_details=c.requirement_details,
        assigned_staff=c.assigned_staff,
        first_followup_date=c.first_followup_date,
        first_followup_time=c.first_followup_time,
        last_followup_date=c.last_followup_date,
        next_followup_date=c.next_followup_date,
        tags=c.tags if isinstance(c.tags, list) else [],
        payment_status=c.payment_status,
        custom_fields=c.custom_fields or {},
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get("", response_model=list[CustomerOut])
async def list_customers(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Customer).order_by(Customer.created_at.desc())
    )).scalars().all()
    return [_to_out(c) for c in rows]


# ── Report routes (must be BEFORE /{customer_id}) ────────────

@router.get("/follow-ups-report")
async def followups_report(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(CustomerFollowup, Customer)
        .join(Customer, Customer.id == CustomerFollowup.customer_id)
        .order_by(CustomerFollowup.created_at.desc())
    )).all()
    return [
        {
            "customer_name": cust.name,
            "customer_phone": cust.phone,
            "assigned_staff": cust.assigned_staff,
            "followup_mode": fu.followup_mode,
            "followup_status": fu.followup_status,
            "notes": fu.notes,
            "next_followup_date": fu.next_followup_date.isoformat() if fu.next_followup_date else None,
            "created_at": fu.created_at.isoformat(),
        }
        for fu, cust in rows
    ]


@router.get("/payment-followups-report")
async def payment_followups_report(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(CustomerPaymentFollowup, Customer)
        .join(Customer, Customer.id == CustomerPaymentFollowup.customer_id)
        .order_by(CustomerPaymentFollowup.created_at.desc())
    )).all()
    return [
        {
            "id": str(pf.id),
            "customer_id": str(pf.customer_id),
            "customer_name": cust.name,
            "customer_phone": cust.phone,
            "customer_company": cust.company,
            "invoice_number": pf.invoice_number,
            "invoice_amount": float(pf.invoice_amount or 0),
            "paid_amount": float(pf.paid_amount or 0),
            "balance_amount": float(pf.balance_amount or 0),
            "payment_status": pf.payment_status,
            "payment_notes": pf.payment_notes,
            "next_payment_followup_date": pf.next_payment_followup_date.isoformat() if pf.next_payment_followup_date else None,
            "reminder_needed": pf.reminder_needed,
            "created_at": pf.created_at.isoformat(),
        }
        for pf, cust in rows
    ]


# ── Sub-resource routes (must be BEFORE /{customer_id}) ──────

@router.get("/{customer_id}/followups")
async def list_followups(customer_id: str, ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(CustomerFollowup)
        .where(CustomerFollowup.customer_id == customer_id)
        .order_by(CustomerFollowup.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": str(r.id), "customer_id": str(r.customer_id),
            "followup_mode": r.followup_mode, "followup_status": r.followup_status,
            "notes": r.notes,
            "next_followup_date": r.next_followup_date.isoformat() if r.next_followup_date else None,
            "next_followup_time": r.next_followup_time,
            "reminder_needed": r.reminder_needed,
            "created_by": str(r.created_by) if r.created_by else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/{customer_id}/followups", status_code=201)
async def add_followup(customer_id: str, body: dict, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    c = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    fu = CustomerFollowup(
        tenant_id=user.tenant_id,
        customer_id=c.id,
        followup_mode=body.get("followup_mode", "call"),
        followup_status=body.get("followup_status", "contacted"),
        notes=body.get("notes"),
        next_followup_date=body.get("next_followup_date"),
        next_followup_time=body.get("next_followup_time"),
        reminder_needed=bool(body.get("reminder_needed", False)),
        created_by=user.id,
    )
    session.add(fu)
    await session.flush()
    return {
        "id": str(fu.id), "customer_id": str(fu.customer_id),
        "followup_mode": fu.followup_mode, "followup_status": fu.followup_status,
        "notes": fu.notes,
        "next_followup_date": fu.next_followup_date.isoformat() if fu.next_followup_date else None,
        "next_followup_time": fu.next_followup_time,
        "reminder_needed": fu.reminder_needed,
        "created_by": str(fu.created_by) if fu.created_by else None,
        "created_at": fu.created_at.isoformat(),
    }


@router.get("/{customer_id}/payment-followups")
async def list_payment_followups(customer_id: str, ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(CustomerPaymentFollowup)
        .where(CustomerPaymentFollowup.customer_id == customer_id)
        .order_by(CustomerPaymentFollowup.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": str(r.id), "customer_id": str(r.customer_id),
            "invoice_number": r.invoice_number,
            "invoice_amount": float(r.invoice_amount or 0),
            "paid_amount": float(r.paid_amount or 0),
            "balance_amount": float(r.balance_amount or 0),
            "payment_status": r.payment_status,
            "payment_notes": r.payment_notes,
            "next_payment_followup_date": r.next_payment_followup_date.isoformat() if r.next_payment_followup_date else None,
            "reminder_needed": r.reminder_needed,
            "created_by": str(r.created_by) if r.created_by else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/{customer_id}/payment-followups", status_code=201)
async def add_payment_followup(customer_id: str, body: dict, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    c = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    pf = CustomerPaymentFollowup(
        tenant_id=user.tenant_id,
        customer_id=c.id,
        invoice_number=body.get("invoice_number"),
        invoice_amount=float(body.get("invoice_amount", 0)),
        paid_amount=float(body.get("paid_amount", 0)),
        balance_amount=float(body.get("balance_amount", 0)),
        payment_status=body.get("payment_status", "payment_pending"),
        payment_notes=body.get("payment_notes"),
        next_payment_followup_date=body.get("next_payment_followup_date"),
        reminder_needed=bool(body.get("reminder_needed", False)),
        created_by=user.id,
    )
    session.add(pf)
    await session.flush()
    return {
        "id": str(pf.id), "customer_id": str(pf.customer_id),
        "invoice_number": pf.invoice_number,
        "invoice_amount": float(pf.invoice_amount or 0),
        "paid_amount": float(pf.paid_amount or 0),
        "balance_amount": float(pf.balance_amount or 0),
        "payment_status": pf.payment_status,
        "payment_notes": pf.payment_notes,
        "next_payment_followup_date": pf.next_payment_followup_date.isoformat() if pf.next_payment_followup_date else None,
        "reminder_needed": pf.reminder_needed,
        "created_by": str(pf.created_by) if pf.created_by else None,
        "created_at": pf.created_at.isoformat(),
    }


@router.get("/{customer_id}/invoices")
async def customer_invoices(customer_id: str, ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Invoice).where(Invoice.customer_id == customer_id).order_by(Invoice.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": str(i.id), "invoice_number": i.invoice_number,
            "issue_date": i.issue_date.isoformat() if i.issue_date else None,
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "total": float(i.total), "amount_paid": float(i.amount_paid or 0),
            "status": i.status,
        }
        for i in rows
    ]


@router.get("/{customer_id}/interactions")
async def list_interactions(customer_id: str, ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Interaction).where(Interaction.customer_id == customer_id)
        .order_by(Interaction.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": str(r.id), "type": r.type, "subject": r.subject,
            "body": r.body, "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/{customer_id}/interactions", status_code=201)
async def add_interaction(customer_id: str, body: dict, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    c = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    ia = Interaction(
        tenant_id=user.tenant_id,
        customer_id=c.id,
        type=body.get("type", "note"),
        subject=body.get("subject"),
        body=body["body"],
        created_by=user.id,
    )
    session.add(ia)
    await session.flush()
    return {"id": str(ia.id), "type": ia.type, "subject": ia.subject,
            "body": ia.body, "created_at": ia.created_at.isoformat()}


@router.delete("/{customer_id}/interactions/{interaction_id}", status_code=204)
async def delete_interaction(customer_id: str, interaction_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    ia = (await session.execute(
        select(Interaction).where(Interaction.id == interaction_id,
                                   Interaction.customer_id == customer_id)
    )).scalar_one_or_none()
    if not ia:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interaction not found")
    await session.delete(ia)


@router.patch("/{customer_id}/crm-status", response_model=CustomerOut)
async def patch_crm_status(customer_id: str, body: dict, ctx=Depends(get_request_context)):
    session = ctx["session"]
    c = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    c.crm_status = body.get("crm_status", c.crm_status)
    await session.flush()
    return _to_out(c)


# ── Single customer CRUD ──────────────────────────────────────

@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, ctx=Depends(get_request_context)):
    c = (await ctx["session"].execute(
        select(Customer).where(Customer.id == customer_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    return _to_out(c)


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(body: CustomerIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    clean = await validate_custom_fields(session, "customer", body.custom_fields)
    c = Customer(
        tenant_id=user.tenant_id,
        name=body.name, email=body.email, phone=body.phone, whatsapp=body.whatsapp,
        company=body.company, address=body.address, notes=body.notes,
        status=body.status, crm_status=body.crm_status, priority=body.priority,
        source=body.source, interested_service=body.interested_service,
        requirement_details=body.requirement_details, assigned_staff=body.assigned_staff,
        first_followup_date=body.first_followup_date, first_followup_time=body.first_followup_time,
        last_followup_date=body.last_followup_date, next_followup_date=body.next_followup_date,
        tags=body.tags or [], payment_status=body.payment_status,
        custom_fields=clean, created_by=user.id,
    )
    session.add(c)
    await session.flush()
    return _to_out(c)


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(customer_id: str, body: CustomerIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    c = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    clean = await validate_custom_fields(session, "customer", body.custom_fields)
    c.name = body.name
    c.email = body.email
    c.phone = body.phone
    c.whatsapp = body.whatsapp
    c.company = body.company
    c.address = body.address
    c.notes = body.notes
    c.status = body.status
    c.crm_status = body.crm_status
    c.priority = body.priority
    c.source = body.source
    c.interested_service = body.interested_service
    c.requirement_details = body.requirement_details
    c.assigned_staff = body.assigned_staff
    c.first_followup_date = body.first_followup_date
    c.first_followup_time = body.first_followup_time
    c.last_followup_date = body.last_followup_date
    c.next_followup_date = body.next_followup_date
    c.tags = body.tags or []
    c.payment_status = body.payment_status
    c.custom_fields = clean
    await session.flush()
    return _to_out(c)


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    c = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    await session.delete(c)
