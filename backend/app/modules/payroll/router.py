import calendar
from datetime import date, datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth.deps import get_request_context
from app.db.models import Employee, LeaveRequest, Payroll, PayrollAllowance, PayrollDeduction
from app.modules.payroll.schemas import (
    LeaveSummaryOut,
    PayrollIn,
    PayrollOut,
    PayrollStats,
    PayrollStatusIn,
    PayrollAllowanceOut,
    PayrollDeductionOut,
)

router = APIRouter()

WORKING_HOURS_PER_DAY = 8


# ── Helpers ───────────────────────────────────────────────────

def _calc(body: PayrollIn):
    wdays = body.total_working_days or 26
    per_day = float(body.basic_salary) / wdays
    lop_deduction = body.lop_days * per_day
    per_hour = per_day / WORKING_HOURS_PER_DAY

    normal_ot  = body.normal_ot_hours  * per_hour * body.normal_ot_multiplier
    night_ot   = body.night_ot_hours   * per_hour * body.night_ot_multiplier
    holiday_ot = body.holiday_ot_hours * per_hour * body.holiday_ot_multiplier
    total_ot   = normal_ot + night_ot + holiday_ot

    total_allowances = sum(a.amount for a in body.allowances)
    total_deductions = sum(d.amount for d in body.deductions)

    gross  = float(body.basic_salary) + total_allowances + total_ot
    net    = max(gross - total_deductions, 0)
    return {
        "per_day_salary":   round(per_day, 2),
        "lop_deduction":    round(lop_deduction, 2),
        "per_hour_salary":  round(per_hour, 2),
        "total_ot_amount":  round(total_ot, 2),
        "total_allowances": round(total_allowances, 2),
        "total_deductions": round(total_deductions, 2),
        "gross_salary":     round(gross, 2),
        "net_salary":       round(net, 2),
    }


def _build_out(p: Payroll, emp, allws, deds) -> PayrollOut:
    return PayrollOut(
        id=str(p.id),
        employee_id=str(p.employee_id),
        employee_name=emp.full_name if emp else "Unknown",
        employee_no=emp.employee_no if emp else None,
        department=emp.department if emp else None,
        designation=emp.job_title if emp else None,
        phone=emp.phone if emp else None,
        payroll_month=p.payroll_month,
        basic_salary=float(p.basic_salary),
        salary_type=p.salary_type,
        total_working_days=p.total_working_days,
        present_days=float(p.present_days),
        absent_days=float(p.absent_days),
        late_days=p.late_days,
        early_leave_days=p.early_leave_days,
        total_worked_hours=float(p.total_worked_hours),
        required_working_hours=float(p.required_working_hours),
        paid_leave_days=float(p.paid_leave_days),
        sick_leave_days=float(p.sick_leave_days),
        casual_leave_days=float(p.casual_leave_days),
        unpaid_leave_days=float(p.unpaid_leave_days),
        half_day_leave=float(p.half_day_leave),
        remaining_leave_balance=float(p.remaining_leave_balance),
        lop_days=float(p.lop_days),
        per_day_salary=float(p.per_day_salary),
        lop_deduction=float(p.lop_deduction),
        lop_reason=p.lop_reason,
        normal_ot_hours=float(p.normal_ot_hours),
        night_ot_hours=float(p.night_ot_hours),
        holiday_ot_hours=float(p.holiday_ot_hours),
        per_hour_salary=float(p.per_hour_salary),
        normal_ot_multiplier=float(p.normal_ot_multiplier),
        night_ot_multiplier=float(p.night_ot_multiplier),
        holiday_ot_multiplier=float(p.holiday_ot_multiplier),
        total_ot_amount=float(p.total_ot_amount),
        total_allowances=float(p.total_allowances),
        total_deductions=float(p.total_deductions),
        gross_salary=float(p.gross_salary),
        net_salary=float(p.net_salary),
        payroll_status=p.payroll_status,
        payment_status=p.payment_status,
        payment_date=p.payment_date,
        payment_method=p.payment_method,
        transaction_id=p.transaction_id,
        payment_notes=p.payment_notes,
        allowances=[PayrollAllowanceOut(id=str(a.id), allowance_name=a.allowance_name, amount=float(a.amount)) for a in allws],
        deductions=[PayrollDeductionOut(id=str(d.id), deduction_name=d.deduction_name, amount=float(d.amount)) for d in deds],
        created_at=p.created_at,
    )


async def _to_out(p: Payroll, session) -> PayrollOut:
    emp = (await session.execute(select(Employee).where(Employee.id == p.employee_id))).scalar_one_or_none()
    allws = (await session.execute(select(PayrollAllowance).where(PayrollAllowance.payroll_id == p.id))).scalars().all()
    deds  = (await session.execute(select(PayrollDeduction).where(PayrollDeduction.payroll_id == p.id))).scalars().all()
    return _build_out(p, emp, allws, deds)


def _table_missing(exc: Exception) -> bool:
    return "relation" in str(exc) and "does not exist" in str(exc)


# ── Stats (must be BEFORE /{payroll_id}) ──────────────────────

@router.get("/stats", response_model=PayrollStats)
async def get_stats(month: str | None = Query(None), ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    try:
        q = select(Payroll).where(Payroll.tenant_id == user.tenant_id)
        if month:
            q = q.where(Payroll.payroll_month == month)
        rows = (await session.execute(q)).scalars().all()
    except Exception as exc:
        if _table_missing(exc):
            return PayrollStats(total_employees=0, total_payroll=0, paid_count=0, pending_count=0, total_deductions=0, total_ot_amount=0)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")
    total_payroll  = sum(float(r.net_salary) for r in rows)
    paid_count     = sum(1 for r in rows if r.payment_status == "paid")
    pending_count  = sum(1 for r in rows if r.payment_status in ("unpaid", "payment_pending"))
    total_deds     = sum(float(r.total_deductions) for r in rows)
    total_ot       = sum(float(r.total_ot_amount) for r in rows)
    unique_emps    = len({r.employee_id for r in rows})
    return PayrollStats(
        total_employees=unique_emps,
        total_payroll=round(total_payroll, 2),
        paid_count=paid_count,
        pending_count=pending_count,
        total_deductions=round(total_deds, 2),
        total_ot_amount=round(total_ot, 2),
    )


# ── Leave summary for a given employee + month ────────────────

@router.get("/leave-summary/{employee_id}", response_model=LeaveSummaryOut)
async def leave_summary(
    employee_id: str,
    month: str = Query(...),
    ctx=Depends(get_request_context),
):
    session = ctx["session"]
    year, mon = map(int, month.split("-"))
    first_day = date(year, mon, 1)
    last_day  = date(year, mon, calendar.monthrange(year, mon)[1])

    rows = (await session.execute(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= last_day,
            LeaveRequest.end_date   >= first_day,
        )
    )).scalars().all()

    paid = sick = casual = unpaid = half = 0.0
    for lr in rows:
        lt = (lr.leave_type or "").lower()
        d  = float(lr.days or 0)
        if "sick" in lt:      sick    += d
        elif "casual" in lt:  casual  += d
        elif "unpaid" in lt:  unpaid  += d
        elif "half" in lt:    half    += d
        else:                 paid    += d

    emp = (await session.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    remaining = float(emp.annual_leave_balance or 0) if emp else 0.0

    return LeaveSummaryOut(
        paid_leave_days=paid,
        sick_leave_days=sick,
        casual_leave_days=casual,
        unpaid_leave_days=unpaid,
        half_day_leave=half,
        remaining_leave_balance=remaining,
    )


# ── Bulk generate draft payrolls for a month ──────────────────

@router.post("/bulk-generate")
async def bulk_generate(body: dict = Body(...), ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    month = body.get("month")
    if not month:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "month is required")

    try:
        employees = (await session.execute(
            select(Employee).where(
                Employee.tenant_id == user.tenant_id,
                Employee.status == "active",
            )
        )).scalars().all()

        existing = set(
            (await session.execute(
                select(Payroll.employee_id).where(
                    Payroll.tenant_id == user.tenant_id,
                    Payroll.payroll_month == month,
                )
            )).scalars().all()
        )
    except Exception as exc:
        if _table_missing(exc):
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "payrolls table missing. Run backend/migrations/payroll_extended.sql in Supabase SQL Editor.",
            )
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")

    created = skipped = 0
    for emp in employees:
        if emp.id in existing:
            skipped += 1
            continue
        session.add(Payroll(
            tenant_id=user.tenant_id,
            employee_id=emp.id,
            payroll_month=month,
            basic_salary=float(emp.salary or 0),
            salary_type="monthly",
            total_working_days=26,
            payroll_status="draft",
            payment_status="unpaid",
            created_by=user.id,
        ))
        created += 1

    await session.flush()
    return {"created": created, "skipped": skipped, "month": month}


# ── CRUD ──────────────────────────────────────────────────────

@router.get("/", response_model=list[PayrollOut])
async def list_payrolls(
    month: str | None = Query(None),
    payroll_status: str | None = Query(None),
    dept: str | None = Query(None),
    ctx=Depends(get_request_context),
):
    session, user = ctx["session"], ctx["user"]
    try:
        q = select(Payroll).where(Payroll.tenant_id == user.tenant_id).order_by(
            Payroll.payroll_month.desc(), Payroll.created_at.desc()
        )
        if month:
            q = q.where(Payroll.payroll_month == month)
        if payroll_status:
            q = q.where(Payroll.payroll_status == payroll_status)
        rows = (await session.execute(q)).scalars().all()
    except Exception as exc:
        if _table_missing(exc):
            return []
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {exc}")

    if not rows:
        return []

    # Batch fetch — 3 queries total instead of 3N
    payroll_ids = [r.id for r in rows]
    emp_ids = list({r.employee_id for r in rows})

    emps_map = {
        e.id: e for e in (await session.execute(
            select(Employee).where(Employee.id.in_(emp_ids))
        )).scalars().all()
    }
    allws_map: dict = {}
    for a in (await session.execute(
        select(PayrollAllowance).where(PayrollAllowance.payroll_id.in_(payroll_ids))
    )).scalars().all():
        allws_map.setdefault(a.payroll_id, []).append(a)

    deds_map: dict = {}
    for d in (await session.execute(
        select(PayrollDeduction).where(PayrollDeduction.payroll_id.in_(payroll_ids))
    )).scalars().all():
        deds_map.setdefault(d.payroll_id, []).append(d)

    result = []
    for p in rows:
        emp = emps_map.get(p.employee_id)
        if dept and (emp is None or (emp.department or "").lower() != dept.lower()):
            continue
        result.append(_build_out(p, emp, allws_map.get(p.id, []), deds_map.get(p.id, [])))
    return result


@router.post("/", response_model=PayrollOut, status_code=201)
async def create_payroll(body: PayrollIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    c = _calc(body)
    p = Payroll(
        tenant_id=user.tenant_id,
        employee_id=body.employee_id,
        payroll_month=body.payroll_month,
        basic_salary=body.basic_salary,
        salary_type=body.salary_type,
        total_working_days=body.total_working_days,
        present_days=body.present_days,
        absent_days=body.absent_days,
        late_days=body.late_days,
        early_leave_days=body.early_leave_days,
        total_worked_hours=body.total_worked_hours,
        required_working_hours=body.required_working_hours,
        paid_leave_days=body.paid_leave_days,
        sick_leave_days=body.sick_leave_days,
        casual_leave_days=body.casual_leave_days,
        unpaid_leave_days=body.unpaid_leave_days,
        half_day_leave=body.half_day_leave,
        remaining_leave_balance=body.remaining_leave_balance,
        lop_days=body.lop_days,
        per_day_salary=c["per_day_salary"],
        lop_deduction=c["lop_deduction"],
        lop_reason=body.lop_reason,
        normal_ot_hours=body.normal_ot_hours,
        night_ot_hours=body.night_ot_hours,
        holiday_ot_hours=body.holiday_ot_hours,
        per_hour_salary=c["per_hour_salary"],
        normal_ot_multiplier=body.normal_ot_multiplier,
        night_ot_multiplier=body.night_ot_multiplier,
        holiday_ot_multiplier=body.holiday_ot_multiplier,
        total_ot_amount=c["total_ot_amount"],
        total_allowances=c["total_allowances"],
        total_deductions=c["total_deductions"],
        gross_salary=c["gross_salary"],
        net_salary=c["net_salary"],
        payroll_status=body.payroll_status,
        payment_status=body.payment_status,
        payment_date=body.payment_date,
        payment_method=body.payment_method,
        transaction_id=body.transaction_id,
        payment_notes=body.payment_notes,
        created_by=user.id,
    )
    session.add(p)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A payroll record already exists for this employee and month")
    for a in body.allowances:
        session.add(PayrollAllowance(payroll_id=p.id, allowance_name=a.allowance_name, amount=a.amount))
    for d in body.deductions:
        session.add(PayrollDeduction(payroll_id=p.id, deduction_name=d.deduction_name, amount=d.amount))
    await session.flush()
    return await _to_out(p, session)


@router.get("/{payroll_id}", response_model=PayrollOut)
async def get_payroll(payroll_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    p = (await session.execute(select(Payroll).where(Payroll.id == payroll_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll not found")
    return await _to_out(p, session)


@router.put("/{payroll_id}", response_model=PayrollOut)
async def update_payroll(payroll_id: str, body: PayrollIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    p = (await session.execute(select(Payroll).where(Payroll.id == payroll_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll not found")
    if p.payroll_status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot edit a paid payroll record")

    c = _calc(body)
    p.basic_salary = body.basic_salary
    p.salary_type = body.salary_type
    p.total_working_days = body.total_working_days
    p.present_days = body.present_days
    p.absent_days = body.absent_days
    p.late_days = body.late_days
    p.early_leave_days = body.early_leave_days
    p.total_worked_hours = body.total_worked_hours
    p.required_working_hours = body.required_working_hours
    p.paid_leave_days = body.paid_leave_days
    p.sick_leave_days = body.sick_leave_days
    p.casual_leave_days = body.casual_leave_days
    p.unpaid_leave_days = body.unpaid_leave_days
    p.half_day_leave = body.half_day_leave
    p.remaining_leave_balance = body.remaining_leave_balance
    p.lop_days = body.lop_days
    p.per_day_salary = c["per_day_salary"]
    p.lop_deduction = c["lop_deduction"]
    p.lop_reason = body.lop_reason
    p.normal_ot_hours = body.normal_ot_hours
    p.night_ot_hours = body.night_ot_hours
    p.holiday_ot_hours = body.holiday_ot_hours
    p.per_hour_salary = c["per_hour_salary"]
    p.normal_ot_multiplier = body.normal_ot_multiplier
    p.night_ot_multiplier = body.night_ot_multiplier
    p.holiday_ot_multiplier = body.holiday_ot_multiplier
    p.total_ot_amount = c["total_ot_amount"]
    p.total_allowances = c["total_allowances"]
    p.total_deductions = c["total_deductions"]
    p.gross_salary = c["gross_salary"]
    p.net_salary = c["net_salary"]
    p.payroll_status = body.payroll_status
    p.payment_status = body.payment_status
    p.payment_date = body.payment_date
    p.payment_method = body.payment_method
    p.transaction_id = body.transaction_id
    p.payment_notes = body.payment_notes
    p.updated_at = datetime.now(timezone.utc)

    old_allws = (await session.execute(select(PayrollAllowance).where(PayrollAllowance.payroll_id == p.id))).scalars().all()
    for a in old_allws:
        await session.delete(a)
    old_deds = (await session.execute(select(PayrollDeduction).where(PayrollDeduction.payroll_id == p.id))).scalars().all()
    for d in old_deds:
        await session.delete(d)
    await session.flush()

    for a in body.allowances:
        session.add(PayrollAllowance(payroll_id=p.id, allowance_name=a.allowance_name, amount=a.amount))
    for d in body.deductions:
        session.add(PayrollDeduction(payroll_id=p.id, deduction_name=d.deduction_name, amount=d.amount))
    await session.flush()
    return await _to_out(p, session)


@router.patch("/{payroll_id}/status", response_model=PayrollOut)
async def update_payroll_status(payroll_id: str, body: PayrollStatusIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    p = (await session.execute(select(Payroll).where(Payroll.id == payroll_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll not found")
    valid_ps  = {"draft", "calculated", "pending_approval", "approved", "paid", "hold", "cancelled"}
    valid_pay = {"unpaid", "payment_pending", "paid", "hold"}
    if body.payroll_status and body.payroll_status not in valid_ps:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid payroll_status")
    if body.payment_status and body.payment_status not in valid_pay:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid payment_status")
    if body.payroll_status:  p.payroll_status  = body.payroll_status
    if body.payment_status:  p.payment_status  = body.payment_status
    if body.payment_date:    p.payment_date    = body.payment_date
    if body.payment_method:  p.payment_method  = body.payment_method
    if body.transaction_id:  p.transaction_id  = body.transaction_id
    if body.payment_notes:   p.payment_notes   = body.payment_notes
    p.updated_at = datetime.now(timezone.utc)
    await session.flush()
    return await _to_out(p, session)


@router.delete("/{payroll_id}", status_code=204)
async def delete_payroll(payroll_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    p = (await session.execute(select(Payroll).where(Payroll.id == payroll_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll not found")
    if p.payroll_status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot delete a paid payroll record")
    await session.delete(p)
