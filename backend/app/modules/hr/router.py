from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth.deps import get_request_context
from app.db.models import Department, Employee, LeaveRequest, PayrollRecord
from app.modules.custom_fields import validate_custom_fields
from app.modules.hr.schemas import (
    DepartmentIn, DepartmentOut,
    EmployeeIn, EmployeeOut,
    LeaveRequestIn, LeaveRequestOut, LeaveStatusIn,
    PayrollIn, PayrollOut, PayrollStatusIn,
)

router = APIRouter()


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

async def _payroll_out(pr: PayrollRecord, session) -> PayrollOut:
    emp = (await session.execute(select(Employee).where(Employee.id == pr.employee_id))).scalar_one_or_none()
    return PayrollOut(
        id=str(pr.id), employee_id=str(pr.employee_id),
        employee_name=emp.full_name if emp else "Unknown",
        period_month=pr.period_month, period_year=pr.period_year,
        basic_salary=float(pr.basic_salary), allowances=float(pr.allowances),
        deductions=float(pr.deductions), net_salary=float(pr.net_salary),
        status=pr.status, notes=pr.notes, created_at=pr.created_at,
    )


@router.get("/payroll", response_model=list[PayrollOut])
async def list_payroll(ctx=Depends(get_request_context)):
    session = ctx["session"]
    rows = (await session.execute(
        select(PayrollRecord).order_by(PayrollRecord.period_year.desc(), PayrollRecord.period_month.desc())
    )).scalars().all()
    return [await _payroll_out(pr, session) for pr in rows]


@router.post("/payroll", response_model=PayrollOut, status_code=201)
async def create_payroll(body: PayrollIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    net = body.basic_salary + body.allowances - body.deductions
    pr = PayrollRecord(
        tenant_id=user.tenant_id, employee_id=body.employee_id,
        period_month=body.period_month, period_year=body.period_year,
        basic_salary=body.basic_salary, allowances=body.allowances,
        deductions=body.deductions, net_salary=net, notes=body.notes,
    )
    session.add(pr)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A payroll record already exists for this employee and period")
    return await _payroll_out(pr, session)


@router.patch("/payroll/{pr_id}/status", response_model=PayrollOut)
async def update_payroll_status(pr_id: str, body: PayrollStatusIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    pr = (await session.execute(select(PayrollRecord).where(PayrollRecord.id == pr_id))).scalar_one_or_none()
    if not pr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll record not found")
    if body.status not in ("draft", "approved", "paid"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid status")
    pr.status = body.status
    await session.flush()
    return await _payroll_out(pr, session)


@router.delete("/payroll/{pr_id}", status_code=204)
async def delete_payroll(pr_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    pr = (await session.execute(select(PayrollRecord).where(PayrollRecord.id == pr_id))).scalar_one_or_none()
    if not pr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll record not found")
    if pr.status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot delete a paid payroll record")
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
    return _emp_out(e)


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(employee_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    e = (await session.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    await session.delete(e)
