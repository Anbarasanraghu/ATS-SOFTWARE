from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.modules.products.router import router as products_router
from app.modules.inventory.router import router as inventory_router
from app.modules.fields_router import router as fields_router
from app.modules.billing.router import router as billing_router
from app.modules.crm.router import router as crm_router
from app.modules.reports.router import router as reports_router
from app.modules.hr.router import router as hr_router
from app.admin.router import router as admin_router

app = FastAPI(title="Modular SaaS ERP API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,      prefix="/auth",       tags=["auth"])
app.include_router(products_router,  prefix="/products",   tags=["products"])
app.include_router(inventory_router, prefix="/inventory",  tags=["inventory"])
app.include_router(billing_router,   prefix="/billing",    tags=["billing"])
app.include_router(crm_router,       prefix="/customers",  tags=["crm"])
app.include_router(reports_router,   prefix="/reports",    tags=["reports"])
app.include_router(hr_router,        prefix="/employees",  tags=["hr"])
app.include_router(fields_router,    tags=["config"])
app.include_router(admin_router,     prefix="/admin",      tags=["admin"])


@app.get("/health")
async def health():
    return {"status": "ok"}
