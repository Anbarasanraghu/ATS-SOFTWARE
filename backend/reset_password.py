"""
CLI script to reset a user's login password.
Usage: python reset_password.py
"""
import asyncio
import getpass
import os
import re
import sys

import asyncpg
import bcrypt


def load_env(path: str) -> dict[str, str]:
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                m = re.match(r"^([A-Z_]+)\s*=\s*(.+)$", line)
                if m:
                    env[m.group(1)] = m.group(2).strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env


def asyncpg_dsn(url: str) -> str:
    return re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)


def hash_password(plain: str) -> str:
    pwd = plain.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd, bcrypt.gensalt()).decode("utf-8")


async def main():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    env = load_env(env_path)

    raw_url = env.get("ADMIN_DATABASE_URL") or env.get("DATABASE_URL")
    if not raw_url:
        print("ERROR: No DATABASE_URL found in backend/.env")
        sys.exit(1)

    dsn = asyncpg_dsn(raw_url)

    print("Connecting to database...")
    conn = await asyncpg.connect(dsn)

    try:
        # List all tenants
        tenants = await conn.fetch("SELECT id, name, slug FROM tenants ORDER BY name")
        if not tenants:
            print("No tenants found in database.")
            return

        print("\nAvailable tenants:")
        for i, t in enumerate(tenants, 1):
            print(f"  {i}. {t['name']}  (slug: {t['slug']})")

        choice = input("\nEnter tenant number: ").strip()
        try:
            tenant = tenants[int(choice) - 1]
        except (ValueError, IndexError):
            print("Invalid selection.")
            return

        tenant_id = tenant["id"]

        # List users for that tenant
        users = await conn.fetch(
            "SELECT id, email, full_name, role FROM users WHERE tenant_id = $1 ORDER BY email",
            tenant_id,
        )
        if not users:
            print(f"No users found for tenant '{tenant['name']}'.")
            return

        print(f"\nUsers in '{tenant['name']}':")
        for i, u in enumerate(users, 1):
            print(f"  {i}. {u['email']}  ({u['full_name'] or '-'}, role: {u['role']})")

        uchoice = input("\nEnter user number: ").strip()
        try:
            user = users[int(uchoice) - 1]
        except (ValueError, IndexError):
            print("Invalid selection.")
            return

        print(f"\nResetting password for: {user['email']}")
        new_password = getpass.getpass("New password: ")
        confirm = getpass.getpass("Confirm password: ")

        if new_password != confirm:
            print("Passwords do not match. Aborted.")
            return

        if len(new_password) < 6:
            print("Password must be at least 6 characters. Aborted.")
            return

        new_hash = hash_password(new_password)
        await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            new_hash,
            user["id"],
        )
        print(f"\nPassword updated successfully for {user['email']}.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
