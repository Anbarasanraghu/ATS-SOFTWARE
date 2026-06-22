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
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb"
        )
        print("Done: tags JSONB column added to customers table.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
