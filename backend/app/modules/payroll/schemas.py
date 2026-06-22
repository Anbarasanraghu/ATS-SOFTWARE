from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class PayrollAllowanceIn(BaseModel):
    allowance_name: str
    amount: float = 0


class PayrollAllowanceOut(BaseModel):
    id: str
    allowance_name: str
    amount: float


class PayrollDeductionIn(BaseModel):
    deduction_name: str
    amount: float = 0


class PayrollDeductionOut(BaseModel):
    id: str
    deduction_name: str
    amount: float


class PayrollIn(BaseModel):
    employee_id: str
    payroll_month: str                  # YYYY-MM
    basic_salary: float
    salary_type: str = "monthly"

    total_working_days: int = 26
    present_days: float = 0
    absent_days: float = 0
    late_days: int = 0
    early_leave_days: int = 0
    total_worked_hours: float = 0
    required_working_hours: float = 0

    paid_leave_days: float = 0
    sick_leave_days: float = 0
    casual_leave_days: float = 0
    unpaid_leave_days: float = 0
    half_day_leave: float = 0
    remaining_leave_balance: float = 0

    lop_days: float = 0
    lop_reason: Optional[str] = None

    normal_ot_hours: float = 0
    night_ot_hours: float = 0
    holiday_ot_hours: float = 0
    normal_ot_multiplier: float = 1.25
    night_ot_multiplier: float = 1.50
    holiday_ot_multiplier: float = 2.00

    allowances: list[PayrollAllowanceIn] = []
    deductions: list[PayrollDeductionIn] = []

    payroll_status: str = "draft"
    payment_status: str = "unpaid"
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    payment_notes: Optional[str] = None


class PayrollOut(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    employee_no: Optional[str]
    department: Optional[str]
    designation: Optional[str]
    phone: Optional[str]
    payroll_month: str
    basic_salary: float
    salary_type: str
    total_working_days: int
    present_days: float
    absent_days: float
    late_days: int
    early_leave_days: int
    total_worked_hours: float
    required_working_hours: float
    paid_leave_days: float
    sick_leave_days: float
    casual_leave_days: float
    unpaid_leave_days: float
    half_day_leave: float
    remaining_leave_balance: float
    lop_days: float
    per_day_salary: float
    lop_deduction: float
    lop_reason: Optional[str]
    normal_ot_hours: float
    night_ot_hours: float
    holiday_ot_hours: float
    per_hour_salary: float
    normal_ot_multiplier: float
    night_ot_multiplier: float
    holiday_ot_multiplier: float
    total_ot_amount: float
    total_allowances: float
    total_deductions: float
    gross_salary: float
    net_salary: float
    payroll_status: str
    payment_status: str
    payment_date: Optional[date]
    payment_method: Optional[str]
    transaction_id: Optional[str]
    payment_notes: Optional[str]
    allowances: list[PayrollAllowanceOut]
    deductions: list[PayrollDeductionOut]
    created_at: datetime


class PayrollStatusIn(BaseModel):
    payroll_status: Optional[str] = None
    payment_status: Optional[str] = None
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    payment_notes: Optional[str] = None


class PayrollStats(BaseModel):
    total_employees: int
    total_payroll: float
    paid_count: int
    pending_count: int
    total_deductions: float
    total_ot_amount: float


class LeaveSummaryOut(BaseModel):
    paid_leave_days: float
    sick_leave_days: float
    casual_leave_days: float
    unpaid_leave_days: float
    half_day_leave: float
    remaining_leave_balance: float
