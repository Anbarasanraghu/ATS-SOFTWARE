from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.modules.products.router import router as products_router
from app.modules.inventory.router import router as inventory_router
from app.modules.inventory.docs_router import router as inventory_docs_router
from app.modules.fields_router import router as fields_router
from app.modules.billing.router import router as billing_router
from app.modules.crm.router import router as crm_router
from app.modules.reports.router import router as reports_router
from app.modules.hr.router import router as hr_router
from app.modules.pharmacy.router import router as pharmacy_router
from app.modules.settings.router import router as settings_router
from app.modules.payroll.router import router as payroll_router
from app.admin.router import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Dispose connection pools cleanly on shutdown so --reload doesn't orphan connections
    from app.db.session import engine, admin_engine
    await engine.dispose()
    await admin_engine.dispose()


app = FastAPI(title="Modular SaaS ERP API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,      prefix="/auth",       tags=["auth"])
app.include_router(products_router,  prefix="/products",   tags=["products"])
app.include_router(inventory_router, prefix="/inventory",  tags=["inventory"])
app.include_router(inventory_docs_router, prefix="/inventory", tags=["inventory"])
app.include_router(billing_router,   prefix="/billing",    tags=["billing"])
app.include_router(crm_router,       prefix="/customers",  tags=["crm"])
app.include_router(reports_router,   prefix="/reports",    tags=["reports"])
app.include_router(hr_router,        prefix="/employees",  tags=["hr"])
app.include_router(pharmacy_router,  prefix="/pharmacy",   tags=["pharmacy"])
app.include_router(fields_router,    tags=["config"])
app.include_router(admin_router,     prefix="/admin",      tags=["admin"])
app.include_router(settings_router,  prefix="/settings",   tags=["settings"])
app.include_router(payroll_router,   prefix="/payroll",    tags=["payroll"])


@app.get("/health")
async def health():
    return {"status": "ok"}
