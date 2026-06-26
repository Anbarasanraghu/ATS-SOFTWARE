import asyncio, asyncpg

DB = "postgresql://postgres.yokyvjtogqplkdylssfc:86680527620@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"

async def main():
    conn = await asyncpg.connect(DB)
    rows = await conn.fetch("SELECT u.email, u.full_name, t.slug FROM users u JOIN tenants t ON u.tenant_id = t.id")
    for r in rows:
        print(r["email"], "|", r["full_name"], "| tenant:", r["slug"])
    await conn.close()

asyncio.run(main())
