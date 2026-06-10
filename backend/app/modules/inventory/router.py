from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth.deps import get_request_context
from app.db.models import Category, Product, StockMovement, Supplier
from app.modules.inventory.schemas import (
    CategoryIn, CategoryOut, StockMovementIn, StockMovementOut,
    SupplierIn, SupplierOut,
)

router = APIRouter()


# ── Categories ───────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Category).order_by(Category.name)
    )).scalars().all()
    return [CategoryOut(id=str(r.id), name=r.name, description=r.description, created_at=r.created_at) for r in rows]


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def create_category(body: CategoryIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    c = Category(tenant_id=user.tenant_id, name=body.name, description=body.description)
    session.add(c)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Category '{body.name}' already exists")
    return CategoryOut(id=str(c.id), name=c.name, description=c.description, created_at=c.created_at)


@router.put("/categories/{cat_id}", response_model=CategoryOut)
async def update_category(cat_id: str, body: CategoryIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    c = (await session.execute(select(Category).where(Category.id == cat_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    c.name = body.name
    c.description = body.description
    return CategoryOut(id=str(c.id), name=c.name, description=c.description, created_at=c.created_at)


@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(cat_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    c = (await session.execute(select(Category).where(Category.id == cat_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    await session.delete(c)


# ── Suppliers ────────────────────────────────────────────────

def _sup_out(s: Supplier) -> SupplierOut:
    return SupplierOut(
        id=str(s.id), name=s.name, email=s.email, phone=s.phone,
        address=s.address, contact_person=s.contact_person,
        notes=s.notes, status=s.status, created_at=s.created_at,
    )


@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Supplier).order_by(Supplier.name)
    )).scalars().all()
    return [_sup_out(s) for s in rows]


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
async def create_supplier(body: SupplierIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    s = Supplier(
        tenant_id=user.tenant_id, name=body.name, email=body.email,
        phone=body.phone, address=body.address, contact_person=body.contact_person,
        notes=body.notes, status=body.status,
    )
    session.add(s)
    await session.flush()
    return _sup_out(s)


@router.put("/suppliers/{sup_id}", response_model=SupplierOut)
async def update_supplier(sup_id: str, body: SupplierIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    s = (await session.execute(select(Supplier).where(Supplier.id == sup_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")
    s.name = body.name; s.email = body.email; s.phone = body.phone
    s.address = body.address; s.contact_person = body.contact_person
    s.notes = body.notes; s.status = body.status
    return _sup_out(s)


@router.delete("/suppliers/{sup_id}", status_code=204)
async def delete_supplier(sup_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    s = (await session.execute(select(Supplier).where(Supplier.id == sup_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")
    await session.delete(s)


# ── Stock Movements ──────────────────────────────────────────

@router.get("/stock-movements", response_model=list[StockMovementOut])
async def list_movements(product_id: str | None = None, ctx=Depends(get_request_context)):
    session = ctx["session"]
    q = select(StockMovement, Product).join(Product, StockMovement.product_id == Product.id)
    if product_id:
        q = q.where(StockMovement.product_id == product_id)
    q = q.order_by(StockMovement.created_at.desc()).limit(200)
    rows = (await session.execute(q)).all()
    return [
        StockMovementOut(
            id=str(mv.id), product_id=str(mv.product_id), product_name=pr.name,
            movement_type=mv.movement_type, quantity=float(mv.quantity),
            unit_cost=float(mv.unit_cost) if mv.unit_cost is not None else None,
            reference=mv.reference, notes=mv.notes, created_at=mv.created_at,
        )
        for mv, pr in rows
    ]


@router.post("/stock-movements", response_model=StockMovementOut, status_code=201)
async def create_movement(body: StockMovementIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]

    product = (await session.execute(
        select(Product).where(Product.id == body.product_id)
    )).scalar_one_or_none()
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    if body.movement_type in ("in", "return"):
        product.stock_qty = float(product.stock_qty) + body.quantity
    elif body.movement_type == "out":
        if float(product.stock_qty) < body.quantity:
            raise HTTPException(status.HTTP_409_CONFLICT, "Insufficient stock")
        product.stock_qty = float(product.stock_qty) - body.quantity
    else:
        product.stock_qty = body.quantity  # adjustment = set absolute

    mv = StockMovement(
        tenant_id=user.tenant_id, product_id=product.id,
        movement_type=body.movement_type, quantity=body.quantity,
        unit_cost=body.unit_cost, reference=body.reference,
        notes=body.notes, created_by=user.id,
    )
    session.add(mv)
    await session.flush()
    return StockMovementOut(
        id=str(mv.id), product_id=str(mv.product_id), product_name=product.name,
        movement_type=mv.movement_type, quantity=float(mv.quantity),
        unit_cost=float(mv.unit_cost) if mv.unit_cost is not None else None,
        reference=mv.reference, notes=mv.notes, created_at=mv.created_at,
    )
