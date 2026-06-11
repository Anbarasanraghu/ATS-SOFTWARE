from datetime import date, datetime
from pydantic import BaseModel, Field


class DepartmentIn(BaseModel):
    name: str
    description: str | None = None


class DepartmentOut(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class EmployeeIn(BaseModel):
    employee_no: str | None = None
    full_name: str
    email: str | None = None
    phone: str | None = None
    department_id: str | None = None
    department: str | None = None
    job_title: str | None = None
    hire_date: date | None = None
    status: str = "active"
    salary: float | None = None
    annual_leave_balance: float = 0
    notes: str | None = None
    custom_fields: dict = {}
    # Statutory + bank + default salary structure
    pan: str | None = None
    aadhaar: str | None = None
    uan: str | None = None
    pf_number: str | None = None
    esi_number: str | None = None
    bank_account: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    salary_structure: dict = {}


class EmployeeOut(BaseModel):
    id: str
    employee_no: str | None
    full_name: str
    email: str | None
    phone: str | None
    department_id: str | None
    department: str | None
    job_title: str | None
    hire_date: date | None
    status: str
    salary: float | None
    annual_leave_balance: float
    notes: str | None
    custom_fields: dict
    pan: str | None = None
    aadhaar: str | None = None
    uan: str | None = None
    pf_number: str | None = None
    esi_number: str | None = None
    bank_account: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    salary_structure: dict = {}
    created_at: datetime
    model_config = {"from_attributes": True}


class LeaveRequestIn(BaseModel):
    employee_id: str
    leave_type: str
    start_date: date
    end_date: date
    days: float
    reason: str | None = None


class LeaveRequestOut(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    leave_type: str
    start_date: date
    end_date: date
    days: float
    reason: str | None
    status: str
    notes: str | None
    created_at: datetime


class LeaveStatusIn(BaseModel):
    status: str
    notes: str | None = None


class PayrollIn(BaseModel):
    employee_id: str
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    earnings: dict = {}                 # basic, hra, da, conveyance, medical, special, bonus, ...
    deductions: dict = {}               # overrides: pf, esi, pt, tds, loan, advance, lop, other
    working_days: float | None = None
    paid_days: float | None = None
    auto_statutory: bool = True         # auto-compute PF/ESI/PT/TDS when not overridden
    notes: str | None = None


class PayrollOut(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    period_month: int
    period_year: int
    basic_salary: float
    allowances: float
    deductions: float
    net_salary: float
    earnings: dict
    deductions_detail: dict
    gross_earnings: float
    total_deductions: float
    employer_pf: float
    employer_esi: float
    working_days: float | None
    paid_days: float | None
    lop_days: float
    paid_on: date | None
    payment_method: str | None
    payment_reference: str | None
    status: str
    notes: str | None
    created_at: datetime


class PayrollStatusIn(BaseModel):
    status: str
    payment_method: str | None = None
    payment_reference: str | None = None
    paid_on: date | None = None


class PayrollRunIn(BaseModel):
    """Generate draft payroll for every active employee for a period."""
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    working_days: float | None = None
    auto_statutory: bool = True
    overwrite: bool = False             # replace existing draft records for the period


class PayrollRunOut(BaseModel):
    created: int
    skipped: int
    records: list[PayrollOut]


class PayrollSummary(BaseModel):
    period_month: int
    period_year: int
    count: int
    gross: float
    deductions: float
    net: float
    employer_pf: float
    employer_esi: float
    pf_total: float
    esi_total: float
    pt_total: float
    tds_total: float
    ctc: float                          # net + all employer + employee statutory
