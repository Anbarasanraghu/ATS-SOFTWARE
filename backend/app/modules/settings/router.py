from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.auth.deps import get_request_context
from app.db.models import CompanySettings, InvoiceSettings, PrintSettings
from app.modules.settings.schemas import (
    CompanySettingsIn, CompanySettingsOut,
    InvoiceSettingsIn, InvoiceSettingsOut,
    PrintSettingsIn,   PrintSettingsOut,
)

router = APIRouter()


def _table_missing(exc: Exception) -> bool:
    return "relation" in str(exc) and "does not exist" in str(exc)


# ── Company Settings ──────────────────────────────────────────

@router.get("/company", response_model=CompanySettingsOut)
async def get_company_settings(ctx=Depends(get_request_context)):
    session   = ctx["session"]
    tenant_id = ctx["tenant_id"]
    try:
        row = (await session.execute(
            select(CompanySettings).where(CompanySettings.tenant_id == tenant_id)
        )).scalar_one_or_none()
    except Exception as exc:
        if _table_missing(exc):
            return CompanySettingsOut()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")
    if row is None:
        return CompanySettingsOut()
    return CompanySettingsOut(
        company_name=row.company_name,
        company_logo=row.company_logo,
        email=row.email,
        phone=row.phone,
        address=row.address,
        gst_number=row.gst_number,
        website=row.website,
        upi_id=row.upi_id,
    )


@router.patch("/company", response_model=CompanySettingsOut)
async def save_company_settings(body: CompanySettingsIn, ctx=Depends(get_request_context)):
    session   = ctx["session"]
    tenant_id = ctx["tenant_id"]
    try:
        row = (await session.execute(
            select(CompanySettings).where(CompanySettings.tenant_id == tenant_id)
        )).scalar_one_or_none()
        if row is None:
            row = CompanySettings(tenant_id=tenant_id)
            session.add(row)
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(row, k, v)
        await session.flush()
    except Exception as exc:
        if _table_missing(exc):
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "company_settings table missing. Run backend/migrations/settings_tables.sql in Supabase SQL Editor.",
            )
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")
    return CompanySettingsOut(
        company_name=row.company_name,
        company_logo=row.company_logo,
        email=row.email,
        phone=row.phone,
        address=row.address,
        gst_number=row.gst_number,
        website=row.website,
        upi_id=row.upi_id,
    )


# ── Invoice Settings ──────────────────────────────────────────

@router.get("/invoice", response_model=InvoiceSettingsOut)
async def get_invoice_settings(ctx=Depends(get_request_context)):
    session   = ctx["session"]
    tenant_id = ctx["tenant_id"]
    try:
        row = (await session.execute(
            select(InvoiceSettings).where(InvoiceSettings.tenant_id == tenant_id)
        )).scalar_one_or_none()
    except Exception as exc:
        if _table_missing(exc):
            return InvoiceSettingsOut()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")
    if row is None:
        return InvoiceSettingsOut()
    return InvoiceSettingsOut(
        invoice_prefix=row.invoice_prefix,
        next_invoice_number=row.next_invoice_number,
        default_tax_percent=float(row.default_tax_percent) if row.default_tax_percent is not None else 0,
        default_payment_terms=row.default_payment_terms,
        default_terms=row.default_terms,
        invoice_footer_note=row.invoice_footer_note,
    )


@router.patch("/invoice", response_model=InvoiceSettingsOut)
async def save_invoice_settings(body: InvoiceSettingsIn, ctx=Depends(get_request_context)):
    session   = ctx["session"]
    tenant_id = ctx["tenant_id"]
    try:
        row = (await session.execute(
            select(InvoiceSettings).where(InvoiceSettings.tenant_id == tenant_id)
        )).scalar_one_or_none()
        if row is None:
            row = InvoiceSettings(tenant_id=tenant_id)
            session.add(row)
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(row, k, v)
        await session.flush()
    except Exception as exc:
        if _table_missing(exc):
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "invoice_settings table missing. Run backend/migrations/settings_tables.sql in Supabase SQL Editor.",
            )
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")
    return InvoiceSettingsOut(
        invoice_prefix=row.invoice_prefix,
        next_invoice_number=row.next_invoice_number,
        default_tax_percent=float(row.default_tax_percent) if row.default_tax_percent is not None else 0,
        default_payment_terms=row.default_payment_terms,
        default_terms=row.default_terms,
        invoice_footer_note=row.invoice_footer_note,
    )


# ── Print Settings ────────────────────────────────────────────

@router.get("/print", response_model=PrintSettingsOut)
async def get_print_settings(ctx=Depends(get_request_context)):
    session   = ctx["session"]
    tenant_id = ctx["tenant_id"]
    try:
        row = (await session.execute(
            select(PrintSettings).where(PrintSettings.tenant_id == tenant_id)
        )).scalar_one_or_none()
    except Exception as exc:
        if _table_missing(exc):
            return PrintSettingsOut()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")
    if row is None:
        return PrintSettingsOut()
    return PrintSettingsOut(
        default_print_size=row.default_print_size or "a4",
        enable_a4_full=row.enable_a4_full,
        enable_a4_half=row.enable_a4_half,
        enable_33x55=row.enable_33x55,
        show_logo=row.show_logo,
        show_gst=row.show_gst,
        show_terms=row.show_terms,
        show_signature=row.show_signature,
    )


@router.patch("/print", response_model=PrintSettingsOut)
async def save_print_settings(body: PrintSettingsIn, ctx=Depends(get_request_context)):
    session   = ctx["session"]
    tenant_id = ctx["tenant_id"]
    try:
        row = (await session.execute(
            select(PrintSettings).where(PrintSettings.tenant_id == tenant_id)
        )).scalar_one_or_none()
        if row is None:
            row = PrintSettings(tenant_id=tenant_id)
            session.add(row)
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(row, k, v)
        await session.flush()
    except Exception as exc:
        if _table_missing(exc):
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "print_settings table missing. Run backend/migrations/settings_tables.sql in Supabase SQL Editor.",
            )
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")
    return PrintSettingsOut(
        default_print_size=row.default_print_size or "a4",
        enable_a4_full=row.enable_a4_full,
        enable_a4_half=row.enable_a4_half,
        enable_33x55=row.enable_33x55,
        show_logo=row.show_logo,
        show_gst=row.show_gst,
        show_terms=row.show_terms,
        show_signature=row.show_signature,
    )
