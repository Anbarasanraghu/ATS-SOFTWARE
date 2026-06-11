import calendar
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth.deps import get_request_context
from app.db.models import Department, Employee, LeaveRequest, PayrollRecord, Tenant
from app.modules.custom_fields import validate_custom_fields
from app.modules.hr import payroll_calc
from app.modules.inventory.activity import log_activity
from app.modules.hr.schemas import (
    DepartmentIn, DepartmentOut,
    EmployeeIn, EmployeeOut,
    LeaveRequestIn, LeaveRequestOut, LeaveStatusIn,
    PayrollIn, PayrollOut, PayrollRunIn, PayrollRunOut, PayrollStatusIn, PayrollSummary,
)

router = APIRouter()

# Payroll is sensitive — only owners/admins/managers (or platform admins) may touch it.
_HR_ROLES = {"owner", "admin", "manager"}


def _require_hr(ctx):
    user = ctx["user"]
    if not (user.is_platform_admin or user.role in _HR_ROLES):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Payroll access requires an admin/manager role")


# ── Departments ──────────────────────────────────────────────
# Must be defined before /{employee_id} to avoid route capture

@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Department).order_by(Department.name)
    )).scalars().all()
    return [DepartmentOut(id=str(d.id), name=d.name, description=d.description, created_at=d.created_at) for d in rows]


@router.post("/departments", response_model=DepartmentOut, status_code=201)
async def create_department(body: DepartmentIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    d = Department(tenant_id=user.tenant_id, name=body.name, description=body.description)
    session.add(d)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Department '{body.name}' already exists")
    return DepartmentOut(id=str(d.id), name=d.name, description=d.description, created_at=d.created_at)


@router.put("/departments/{dept_id}", response_model=DepartmentOut)
async def update_department(dept_id: str, body: DepartmentIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    d = (await session.execute(select(Department).where(Department.id == dept_id))).scalar_one_or_none()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")
    d.name = body.name; d.description = body.description
    return DepartmentOut(id=str(d.id), name=d.name, description=d.description, created_at=d.created_at)


@router.delete("/departments/{dept_id}", status_code=204)
async def delete_department(dept_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    d = (await session.execute(select(Department).where(Department.id == dept_id))).scalar_one_or_none()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")
    await session.delete(d)


# ── Leave Requests ───────────────────────────────────────────
# Must be defined before /{employee_id}

async def _leave_out(lr: LeaveRequest, session) -> LeaveRequestOut:
    emp = (await session.execute(select(Employee).where(Employee.id == lr.employee_id))).scalar_one_or_none()
    return LeaveRequestOut(
        id=str(lr.id), employee_id=str(lr.employee_id),
        employee_name=emp.full_name if emp else "Unknown",
        leave_type=lr.leave_type, start_date=lr.start_date, end_date=lr.end_date,
        days=float(lr.days), reason=lr.reason, status=lr.status,
        notes=lr.notes, created_at=lr.created_at,
    )


@router.get("/leave-requests", response_model=list[LeaveRequestOut])
async def list_leave_requests(ctx=Depends(get_request_context)):
    session = ctx["session"]
    rows = (await session.execute(
        select(LeaveRequest).order_by(LeaveRequest.created_at.desc())
    )).scalars().all()
    return [await _leave_out(lr, session) for lr in rows]


@router.post("/leave-requests", response_model=LeaveRequestOut, status_code=201)
async def create_leave_request(body: LeaveRequestIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    lr = LeaveRequest(
        tenant_id=user.tenant_id, employee_id=body.employee_id,
        leave_type=body.leave_type, start_date=body.start_date,
        end_date=body.end_date, days=body.days, reason=body.reason,
    )
    session.add(lr)
    await session.flush()
    return await _leave_out(lr, session)


@router.patch("/leave-requests/{lr_id}/status", response_model=LeaveRequestOut)
async def update_leave_status(lr_id: str, body: LeaveStatusIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    lr = (await session.execute(select(LeaveRequest).where(LeaveRequest.id == lr_id))).scalar_one_or_none()
    if not lr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    if body.status not in ("pending", "approved", "rejected"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid status")
    lr.status = body.status
    lr.notes = body.notes
    lr.approved_by = user.id if body.status == "approved" else None
    await session.flush()
    return await _leave_out(lr, session)


@router.delete("/leave-requests/{lr_id}", status_code=204)
async def delete_leave_request(lr_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    lr = (await session.execute(select(LeaveRequest).where(LeaveRequest.id == lr_id))).scalar_one_or_none()
    if not lr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    if lr.status == "approved":
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot delete an approved leave request")
    await session.delete(lr)


# ── Payroll ──────────────────────────────────────────────────
# Must be defined before /{employee_id}

def _payroll_out(pr: PayrollRecord, emp_name: str) -> PayrollOut:
    return PayrollOut(
        id=str(pr.id), employee_id=str(pr.employee_id), employee_name=emp_name,
        period_month=pr.period_month, period_year=pr.period_year,
        basic_salary=float(pr.basic_salary), allowances=float(pr.allowances),
        deductions=float(pr.deductions), net_salary=float(pr.net_salary),
        earnings=pr.earnings or {}, deductions_detail=pr.deductions_detail or {},
        gross_earnings=float(pr.gross_earnings or 0), total_deductions=float(pr.total_deductions or 0),
        employer_pf=float(pr.employer_pf or 0), employer_esi=float(pr.employer_esi or 0),
        working_days=float(pr.working_days) if pr.working_days is not None else None,
        paid_days=float(pr.paid_days) if pr.paid_days is not None else None,
        lop_days=float(pr.lop_days or 0),
        paid_on=pr.paid_on, payment_method=pr.payment_method, payment_reference=pr.payment_reference,
        status=pr.status, notes=pr.notes, created_at=pr.created_at,
    )


async def _emp_name(session, employee_id) -> str:
    emp = (await session.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    return emp.full_name if emp else "Unknown"


def _apply_breakdown(pr: PayrollRecord, calc: dict, *, working_days=None, paid_days=None, lop_days=0.0):
    """Write a payroll_calc result onto the record (incl. legacy columns)."""
    pr.earnings = calc["earnings"]
    pr.deductions_detail = calc["deductions_detail"]
    pr.gross_earnings = calc["gross_earnings"]
    pr.total_deductions = calc["total_deductions"]
    pr.net_salary = calc["net_salary"]
    pr.employer_pf = calc["employer_pf"]
    pr.employer_esi = calc["employer_esi"]
    pr.working_days = working_days
    pr.paid_days = paid_days
    pr.lop_days = lop_days
    # legacy/flat columns kept in sync for older views
    pr.basic_salary = calc["earnings"].get("basic", 0)
    pr.allowances = round(calc["gross_earnings"] - pr.basic_salary, 2)
    pr.deductions = calc["total_deductions"]


def _lop_for(earnings: dict, working_days, paid_days) -> tuple[float, float]:
    """Return (lop_days, lop_amount) prorated on gross."""
    if not working_days or paid_days is None or paid_days >= working_days:
        return 0.0, 0.0
    lop_days = round(float(working_days) - float(paid_days), 1)
    gross = payroll_calc.gross_of(earnings)
    return lop_days, round(gross / float(working_days) * lop_days, 2)


@router.get("/payroll", response_model=list[PayrollOut])
async def list_payroll(month: int | None = None, year: int | None = None,
                       status_f: str | None = None, ctx=Depends(get_request_context)):
    _require_hr(ctx)
    session = ctx["session"]
    q = select(PayrollRecord, Employee.full_name).join(
        Employee, PayrollRecord.employee_id == Employee.id, isouter=True
    )
    if month:
        q = q.where(PayrollRecord.period_month == month)
    if year:
        q = q.where(PayrollRecord.period_year == year)
    if status_f:
        q = q.where(PayrollRecord.status == status_f)
    q = q.order_by(PayrollRecord.period_year.desc(), PayrollRecord.period_month.desc())
    rows = (await session.execute(q)).all()
    return [_payroll_out(pr, name or "Unknown") for pr, name in rows]


@router.post("/payroll", response_model=PayrollOut, status_code=201)
async def create_payroll(body: PayrollIn, ctx=Depends(get_request_context)):
    _require_hr(ctx)
    session, user = ctx["session"], ctx["user"]
    emp = (await session.execute(select(Employee).where(Employee.id == body.employee_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")

    earnings = body.earnings or (emp.salary_structure or {}) or {"basic": float(emp.salary or 0)}
    lop_days, lop_amount = _lop_for(earnings, body.working_days, body.paid_days)
    calc = payroll_calc.compute(earnings, overrides=body.deductions,
                                auto_statutory=body.auto_statutory, lop_amount=lop_amount)
    pr = PayrollRecord(
        tenant_id=user.tenant_id, employee_id=body.employee_id,
        period_month=body.period_month, period_year=body.period_year, notes=body.notes,
    )
    _apply_breakdown(pr, calc, working_days=body.working_days, paid_days=body.paid_days, lop_days=lop_days)
    session.add(pr)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A payroll record already exists for this employee and period")
    await log_activity(session, user, entity="payroll", action="create",
                       entity_id=pr.id, entity_name=emp.full_name,
                       detail={"period": f"{body.period_month}/{body.period_year}", "net": calc["net_salary"]})
    return _payroll_out(pr, emp.full_name)


@router.put("/payroll/{pr_id}", response_model=PayrollOut)
async def update_payroll(pr_id: str, body: PayrollIn, ctx=Depends(get_request_context)):
    _require_hr(ctx)
    session, user = ctx["session"], ctx["user"]
    pr = (await session.execute(select(PayrollRecord).where(PayrollRecord.id == pr_id))).scalar_one_or_none()
    if not pr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll record not found")
    if pr.status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot edit a paid payroll record")
    earnings = body.earnings or {}
    lop_days, lop_amount = _lop_for(earnings, body.working_days, body.paid_days)
    calc = payroll_calc.compute(earnings, overrides=body.deductions,
                                auto_statutory=body.auto_statutory, lop_amount=lop_amount)
    _apply_breakdown(pr, calc, working_days=body.working_days, paid_days=body.paid_days, lop_days=lop_days)
    pr.notes = body.notes
    await session.flush()
    name = await _emp_name(session, pr.employee_id)
    await log_activity(session, user, entity="payroll", action="update",
                       entity_id=pr.id, entity_name=name,
                       detail={"period": f"{pr.period_month}/{pr.period_year}", "net": calc["net_salary"]})
    return _payroll_out(pr, name)


@router.post("/payroll/run", response_model=PayrollRunOut)
async def run_payroll(body: PayrollRunIn, ctx=Depends(get_request_context)):
    """Generate draft payroll for every active employee for the period,
    auto-computing statutory deductions and LOP from approved unpaid leave."""
    _require_hr(ctx)
    session, user = ctx["session"], ctx["user"]
    work_days = body.working_days or calendar.monthrange(body.period_year, body.period_month)[1]
    month_start = date(body.period_year, body.period_month, 1)
    month_end = date(body.period_year, body.period_month,
                     calendar.monthrange(body.period_year, body.period_month)[1])

    employees = (await session.execute(
        select(Employee).where(Employee.status == "active")
    )).scalars().all()
    existing = {
        str(r.employee_id): r for r in (await session.execute(
            select(PayrollRecord).where(
                PayrollRecord.period_month == body.period_month,
                PayrollRecord.period_year == body.period_year,
            )
        )).scalars().all()
    }
    # Approved unpaid-leave days per employee that overlap this month.
    leaves = (await session.execute(
        select(LeaveRequest).where(
            LeaveRequest.status == "approved",
            LeaveRequest.leave_type == "unpaid",
            LeaveRequest.start_date <= month_end,
            LeaveRequest.end_date >= month_start,
        )
    )).scalars().all()
    lop_by_emp: dict[str, float] = {}
    for lv in leaves:
        s = max(lv.start_date, month_start)
        e = min(lv.end_date, month_end)
        lop_by_emp[str(lv.employee_id)] = lop_by_emp.get(str(lv.employee_id), 0.0) + (e - s).days + 1

    created, skipped, out = 0, 0, []
    for emp in employees:
        prior = existing.get(str(emp.id))
        if prior and (prior.status != "draft" or not body.overwrite):
            skipped += 1
            if prior:
                out.append(_payroll_out(prior, emp.full_name))
            continue
        earnings = (emp.salary_structure or {}) or ({"basic": float(emp.salary)} if emp.salary else {})
        if not earnings:
            skipped += 1
            continue
        lop_days = round(min(lop_by_emp.get(str(emp.id), 0.0), work_days), 1)
        paid_days = round(work_days - lop_days, 1)
        _, lop_amount = _lop_for(earnings, work_days, paid_days)
        calc = payroll_calc.compute(earnings, auto_statutory=body.auto_statutory, lop_amount=lop_amount)
        if prior:
            await session.delete(prior)
            await session.flush()
        pr = PayrollRecord(
            tenant_id=user.tenant_id, employee_id=emp.id,
            period_month=body.period_month, period_year=body.period_year,
        )
        _apply_breakdown(pr, calc, working_days=work_days, paid_days=paid_days, lop_days=lop_days)
        session.add(pr)
        await session.flush()
        created += 1
        out.append(_payroll_out(pr, emp.full_name))

    await log_activity(session, user, entity="payroll", action="run",
                       entity_name=f"{body.period_month}/{body.period_year}",
                       detail={"created": created, "skipped": skipped})
    return PayrollRunOut(created=created, skipped=skipped, records=out)


@router.patch("/payroll/{pr_id}/status", response_model=PayrollOut)
async def update_payroll_status(pr_id: str, body: PayrollStatusIn, ctx=Depends(get_request_context)):
    _require_hr(ctx)
    session, user = ctx["session"], ctx["user"]
    pr = (await session.execute(select(PayrollRecord).where(PayrollRecord.id == pr_id))).scalar_one_or_none()
    if not pr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll record not found")
    if body.status not in ("draft", "approved", "paid"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid status")
    if pr.status == "paid" and body.status != "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "A paid record is locked")

    pr.status = body.status
    if body.status == "approved":
        pr.approved_by = user.id
    elif body.status == "paid":
        pr.paid_on = body.paid_on or date.today()
        pr.payment_method = body.payment_method
        pr.payment_reference = body.payment_reference
    await session.flush()
    name = await _emp_name(session, pr.employee_id)
    await log_activity(session, user, entity="payroll", action=body.status,
                       entity_id=pr.id, entity_name=name,
                       detail={"period": f"{pr.period_month}/{pr.period_year}", "net": float(pr.net_salary)})
    return _payroll_out(pr, name)


@router.get("/payroll/summary", response_model=PayrollSummary)
async def payroll_summary(month: int, year: int, ctx=Depends(get_request_context)):
    _require_hr(ctx)
    session = ctx["session"]
    rows = (await session.execute(
        select(PayrollRecord).where(
            PayrollRecord.period_month == month, PayrollRecord.period_year == year
        )
    )).scalars().all()
    g = lambda r, k: float((r.deductions_detail or {}).get(k, 0) or 0)  # noqa: E731
    gross = sum(float(r.gross_earnings or 0) for r in rows)
    net = sum(float(r.net_salary or 0) for r in rows)
    ded = sum(float(r.total_deductions or 0) for r in rows)
    er_pf = sum(float(r.employer_pf or 0) for r in rows)
    er_esi = sum(float(r.employer_esi or 0) for r in rows)
    return PayrollSummary(
        period_month=month, period_year=year, count=len(rows),
        gross=round(gross, 2), deductions=round(ded, 2), net=round(net, 2),
        employer_pf=round(er_pf, 2), employer_esi=round(er_esi, 2),
        pf_total=round(sum(g(r, "pf") for r in rows), 2),
        esi_total=round(sum(g(r, "esi") for r in rows), 2),
        pt_total=round(sum(g(r, "pt") for r in rows), 2),
        tds_total=round(sum(g(r, "tds") for r in rows), 2),
        ctc=round(gross + er_pf + er_esi, 2),
    )


@router.get("/payroll/{pr_id}/payslip")
async def payslip(pr_id: str, ctx=Depends(get_request_context)):
    _require_hr(ctx)
    session = ctx["session"]
    pr = (await session.execute(select(PayrollRecord).where(PayrollRecord.id == pr_id))).scalar_one_or_none()
    if not pr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll record not found")
    emp = (await session.execute(select(Employee).where(Employee.id == pr.employee_id))).scalar_one_or_none()

    # Year-to-date within the Indian financial year (Apr–Mar) up to this period.
    fy_start_year = pr.period_year if pr.period_month >= 4 else pr.period_year - 1
    ytd_rows = (await session.execute(
        select(PayrollRecord).where(PayrollRecord.employee_id == pr.employee_id)
    )).scalars().all()

    def in_fy_to_date(r) -> bool:
        ord_r = r.period_year * 12 + r.period_month
        start = fy_start_year * 12 + 4
        end = pr.period_year * 12 + pr.period_month
        return start <= ord_r <= end

    ytd = [r for r in ytd_rows if in_fy_to_date(r)]
    ytd_gross = round(sum(float(r.gross_earnings or 0) for r in ytd), 2)
    ytd_ded = round(sum(float(r.total_deductions or 0) for r in ytd), 2)
    ytd_net = round(sum(float(r.net_salary or 0) for r in ytd), 2)

    tenant = (await session.execute(select(Tenant).where(Tenant.id == ctx["user"].tenant_id))).scalar_one_or_none()
    return {
        "company": {"name": tenant.name if tenant else "Company"},
        "record": _payroll_out(pr, emp.full_name if emp else "Unknown").model_dump(),
        "employee": {
            "full_name": emp.full_name if emp else "Unknown",
            "employee_no": emp.employee_no if emp else None,
            "designation": emp.job_title if emp else None,
            "department": emp.department if emp else None,
            "pan": emp.pan if emp else None, "uan": emp.uan if emp else None,
            "pf_number": emp.pf_number if emp else None, "esi_number": emp.esi_number if emp else None,
            "bank_account": emp.bank_account if emp else None, "bank_ifsc": emp.bank_ifsc if emp else None,
            "bank_name": emp.bank_name if emp else None,
        },
        "ytd": {"gross": ytd_gross, "deductions": ytd_ded, "net": ytd_net, "financial_year": f"{fy_start_year}-{fy_start_year + 1}"},
    }


@router.delete("/payroll/{pr_id}", status_code=204)
async def delete_payroll(pr_id: str, ctx=Depends(get_request_context)):
    _require_hr(ctx)
    session, user = ctx["session"], ctx["user"]
    pr = (await session.execute(select(PayrollRecord).where(PayrollRecord.id == pr_id))).scalar_one_or_none()
    if not pr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll record not found")
    if pr.status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot delete a paid payroll record")
    name = await _emp_name(session, pr.employee_id)
    await log_activity(session, user, entity="payroll", action="delete",
                       entity_id=pr.id, entity_name=name,
                       detail={"period": f"{pr.period_month}/{pr.period_year}"})
    await session.delete(pr)


# ── Employees ────────────────────────────────────────────────
# /{employee_id} routes MUST come last — otherwise they swallow the sub-routes above

def _emp_out(e: Employee) -> EmployeeOut:
    return EmployeeOut(
        id=str(e.id), employee_no=e.employee_no, full_name=e.full_name,
        email=e.email, phone=e.phone,
        department_id=str(e.department_id) if e.department_id else None,
        department=e.department, job_title=e.job_title,
        hire_date=e.hire_date, status=e.status,
        salary=float(e.salary) if e.salary is not None else None,
        annual_leave_balance=float(e.annual_leave_balance or 0),
        notes=e.notes, custom_fields=e.custom_fields or {},
        pan=e.pan, aadhaar=e.aadhaar, uan=e.uan, pf_number=e.pf_number, esi_number=e.esi_number,
        bank_account=e.bank_account, bank_ifsc=e.bank_ifsc, bank_name=e.bank_name,
        salary_structure=e.salary_structure or {},
        created_at=e.created_at,
    )


@router.get("", response_model=list[EmployeeOut])
async def list_employees(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Employee).order_by(Employee.created_at.desc())
    )).scalars().all()
    return [_emp_out(e) for e in rows]


@router.post("", response_model=EmployeeOut, status_code=201)
async def create_employee(body: EmployeeIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    clean = await validate_custom_fields(session, "employee", body.custom_fields)
    e = Employee(
        tenant_id=user.tenant_id, employee_no=body.employee_no, full_name=body.full_name,
        email=body.email, phone=body.phone,
        department_id=body.department_id or None,
        department=body.department, job_title=body.job_title,
        hire_date=body.hire_date, status=body.status, salary=body.salary,
        annual_leave_balance=body.annual_leave_balance,
        notes=body.notes, custom_fields=clean, created_by=user.id,
        pan=body.pan, aadhaar=body.aadhaar, uan=body.uan,
        pf_number=body.pf_number, esi_number=body.esi_number,
        bank_account=body.bank_account, bank_ifsc=body.bank_ifsc, bank_name=body.bank_name,
        salary_structure=body.salary_structure or {},
    )
    session.add(e)
    await session.flush()
    return _emp_out(e)


@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(employee_id: str, ctx=Depends(get_request_context)):
    e = (await ctx["session"].execute(
        select(Employee).where(Employee.id == employee_id)
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    return _emp_out(e)


@router.put("/{employee_id}", response_model=EmployeeOut)
async def update_employee(employee_id: str, body: EmployeeIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    e = (await session.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    clean = await validate_custom_fields(session, "employee", body.custom_fields)
    e.employee_no = body.employee_no; e.full_name = body.full_name
    e.email = body.email; e.phone = body.phone
    e.department_id = body.department_id or None
    e.department = body.department; e.job_title = body.job_title
    e.hire_date = body.hire_date; e.status = body.status
    e.salary = body.salary; e.annual_leave_balance = body.annual_leave_balance
    e.notes = body.notes; e.custom_fields = clean
    e.pan = body.pan; e.aadhaar = body.aadhaar; e.uan = body.uan
    e.pf_number = body.pf_number; e.esi_number = body.esi_number
    e.bank_account = body.bank_account; e.bank_ifsc = body.bank_ifsc; e.bank_name = body.bank_name
    e.salary_structure = body.salary_structure or {}
    return _emp_out(e)


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(employee_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    e = (await session.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    await session.delete(e)
