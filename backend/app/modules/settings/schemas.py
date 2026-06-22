from pydantic import BaseModel
from typing import Optional


class CompanySettingsIn(BaseModel):
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    email:        Optional[str] = None
    phone:        Optional[str] = None
    address:      Optional[str] = None
    gst_number:   Optional[str] = None
    website:      Optional[str] = None
    upi_id:       Optional[str] = None


class CompanySettingsOut(BaseModel):
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    email:        Optional[str] = None
    phone:        Optional[str] = None
    address:      Optional[str] = None
    gst_number:   Optional[str] = None
    website:      Optional[str] = None
    upi_id:       Optional[str] = None


class InvoiceSettingsIn(BaseModel):
    invoice_prefix:        Optional[str]   = None
    next_invoice_number:   Optional[int]   = None
    default_tax_percent:   Optional[float] = None
    default_payment_terms: Optional[str]   = None
    default_terms:         Optional[str]   = None
    invoice_footer_note:   Optional[str]   = None


class InvoiceSettingsOut(BaseModel):
    invoice_prefix:        Optional[str]   = "INV"
    next_invoice_number:   Optional[int]   = 1
    default_tax_percent:   Optional[float] = 0
    default_payment_terms: Optional[str]   = None
    default_terms:         Optional[str]   = None
    invoice_footer_note:   Optional[str]   = None


class PrintSettingsIn(BaseModel):
    default_print_size: Optional[str]  = None
    enable_a4_full:     Optional[bool] = None
    enable_a4_half:     Optional[bool] = None
    enable_33x55:       Optional[bool] = None
    show_logo:          Optional[bool] = None
    show_gst:           Optional[bool] = None
    show_terms:         Optional[bool] = None
    show_signature:     Optional[bool] = None


class PrintSettingsOut(BaseModel):
    default_print_size: str  = "a4"
    enable_a4_full:     bool = True
    enable_a4_half:     bool = True
    enable_33x55:       bool = True
    show_logo:          bool = True
    show_gst:           bool = True
    show_terms:         bool = True
    show_signature:     bool = True
