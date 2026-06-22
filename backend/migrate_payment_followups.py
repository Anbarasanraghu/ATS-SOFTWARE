import asyncio
import os

import asyncpg
from dotenv import load_dotenv

load_dotenv()

ADMIN_URL = (
    os.getenv("ADMIN_DATABASE_URL") or os.getenv("DATABASE_URL") or ""
).replace("postgresql+asyncpg://", "postgresql://")


async def main() -> None:
    print(f"Connecting to: {ADMIN_URL[:50]}…")
    conn = await asyncpg.connect(ADMIN_URL)
    try:
        await conn.execute(
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT NULL"
        )
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS customer_payment_followups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                invoice_number VARCHAR,
                invoice_amount NUMERIC(14,2) DEFAULT 0,
                paid_amount NUMERIC(14,2) DEFAULT 0,
                balance_amount NUMERIC(14,2) DEFAULT 0,
                payment_status VARCHAR DEFAULT 'payment_pending',
                payment_notes TEXT,
                next_payment_followup_date DATE,
                reminder_needed BOOLEAN DEFAULT FALSE,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
        """)
        print("Migration complete:")
        print("  - payment_status column added to customers")
        print("  - customer_payment_followups table created")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
