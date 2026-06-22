-- ── Settings Tables ───────────────────────────────────────────
-- Run this in Supabase SQL Editor before starting the backend.

-- Company Settings (one row per tenant)
CREATE TABLE IF NOT EXISTS company_settings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    company_logo TEXT,          -- base64 data-URL or external URL
    email       VARCHAR(255),
    phone       VARCHAR(50),
    address     TEXT,
    gst_number  VARCHAR(50),
    website     VARCHAR(255),
    upi_id      VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id)
);

-- Invoice Settings (one row per tenant)
CREATE TABLE IF NOT EXISTS invoice_settings (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_prefix        VARCHAR(20)  DEFAULT 'INV',
    next_invoice_number   INTEGER      DEFAULT 1,
    default_tax_percent   NUMERIC(5,2) DEFAULT 0,
    default_payment_terms VARCHAR(100),
    default_terms         TEXT,
    invoice_footer_note   TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id)
);

-- Print Settings (one row per tenant)
CREATE TABLE IF NOT EXISTS print_settings (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    default_print_size VARCHAR(20) DEFAULT 'a4',
    enable_a4_full    BOOLEAN     NOT NULL DEFAULT TRUE,
    enable_a4_half    BOOLEAN     NOT NULL DEFAULT TRUE,
    enable_33x55      BOOLEAN     NOT NULL DEFAULT TRUE,
    show_logo         BOOLEAN     NOT NULL DEFAULT TRUE,
    show_gst          BOOLEAN     NOT NULL DEFAULT TRUE,
    show_terms        BOOLEAN     NOT NULL DEFAULT TRUE,
    show_signature    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id)
);
