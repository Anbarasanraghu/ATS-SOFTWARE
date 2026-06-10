from datetime import date, datetime
from pydantic import BaseModel


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
    period_month: int
    period_year: int
    basic_salary: float
    allowances: float = 0
    deductions: float = 0
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
    status: str
    notes: str | None
    created_at: datetime


class PayrollStatusIn(BaseModel):
    status: str
