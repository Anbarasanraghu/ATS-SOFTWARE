from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.auth.deps import get_request_context
from app.db.models import Customer, Interaction, Invoice
from app.modules.crm.schemas import CustomerIn, CustomerOut
from app.modules.custom_fields import validate_custom_fields

router = APIRouter()


def _to_out(c: Customer) -> CustomerOut:
    return CustomerOut(
        id=str(c.id), name=c.name, email=c.email, phone=c.phone,
        company=c.company, address=c.address, notes=c.notes,
        status=c.status, custom_fields=c.custom_fields or {},
        created_at=c.created_at,
    )


@router.get("", response_model=list[CustomerOut])
async def list_customers(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Customer).order_by(Customer.created_at.desc())
    )).scalars().all()
    return [_to_out(c) for c in rows]


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, ctx=Depends(get_request_context)):
    c = (await ctx["session"].execute(
        select(Customer).where(Customer.id == customer_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    return _to_out(c)


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


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(body: CustomerIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    clean = await validate_custom_fields(session, "customer", body.custom_fields)
    c = Customer(
        tenant_id=user.tenant_id, name=body.name, email=body.email,
        phone=body.phone, company=body.company, address=body.address,
        notes=body.notes, status=body.status, custom_fields=clean, created_by=user.id,
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
    c.name = body.name; c.email = body.email; c.phone = body.phone
    c.company = body.company; c.address = body.address; c.notes = body.notes
    c.status = body.status; c.custom_fields = clean
    return _to_out(c)


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    c = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    await session.delete(c)
