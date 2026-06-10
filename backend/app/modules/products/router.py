from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.auth.deps import get_request_context
from app.db.models import Product
from app.modules.custom_fields import validate_custom_fields
from app.modules.products.schemas import ProductIn, ProductOut

router = APIRouter()


def _to_out(p: Product) -> ProductOut:
    reorder = float(p.reorder_level or 0)
    return ProductOut(
        id=p.id, sku=p.sku, barcode=p.barcode, name=p.name, unit=p.unit,
        price=float(p.price), cost_price=float(p.cost_price or 0),
        tax_percent=float(p.tax_percent), stock_qty=float(p.stock_qty),
        reorder_level=reorder,
        is_low_stock=float(p.stock_qty) <= reorder and reorder > 0,
        category_id=str(p.category_id) if p.category_id else None,
        supplier_id=str(p.supplier_id) if p.supplier_id else None,
        custom_fields=p.custom_fields or {},
    )


# ── Barcode / SKU scan lookup — must be before /{product_id} ──

@router.get("/scan", response_model=ProductOut)
async def scan_product(code: str, ctx=Depends(get_request_context)):
    """Look up a product by barcode or SKU. Used by the POS scanner."""
    session = ctx["session"]
    p = (await session.execute(
        select(Product).where(
            or_(Product.barcode == code, Product.sku == code)
        )
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No product found for code '{code}'")
    return _to_out(p)


@router.get("", response_model=list[ProductOut])
async def list_products(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Product).order_by(Product.created_at.desc())
    )).scalars().all()
    return [_to_out(p) for p in rows]


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, ctx=Depends(get_request_context)):
    p = (await ctx["session"].execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return _to_out(p)


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(body: ProductIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    clean = await validate_custom_fields(session, "product", body.custom_fields)
    p = Product(
        tenant_id=user.tenant_id, sku=body.sku, barcode=body.barcode,
        name=body.name, description=body.description, unit=body.unit,
        price=body.price, cost_price=body.cost_price,
        tax_percent=body.tax_percent, stock_qty=body.stock_qty,
        reorder_level=body.reorder_level,
        category_id=body.category_id or None,
        supplier_id=body.supplier_id or None,
        custom_fields=clean, created_by=user.id,
    )
    session.add(p)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A product with this SKU or barcode already exists")
    return _to_out(p)


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(product_id: str, body: ProductIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    p = (await session.execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    clean = await validate_custom_fields(session, "product", body.custom_fields)
    p.sku = body.sku; p.barcode = body.barcode
    p.name = body.name; p.description = body.description
    p.unit = body.unit; p.price = body.price; p.cost_price = body.cost_price
    p.tax_percent = body.tax_percent; p.stock_qty = body.stock_qty
    p.reorder_level = body.reorder_level
    p.category_id = body.category_id or None
    p.supplier_id = body.supplier_id or None
    p.custom_fields = clean
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A product with this SKU or barcode already exists")
    return _to_out(p)


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    p = (await session.execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    await session.delete(p)
