"""Indian payroll statutory calculations.

All rates/ceilings are constants here so they can be tuned in one place.
Every component an employer might want to override (e.g. a fixed TDS from a
tax declaration) can be passed in explicitly; otherwise it is auto-computed.

Earnings dict keys  : basic, hra, da, conveyance, medical, special, bonus,
                      overtime, arrears, other
Deduction dict keys : pf, esi, pt, tds, loan, advance, lop, other
"""
from __future__ import annotations

# ── Statutory constants (FY 2024-25 defaults) ────────────────
PF_RATE_EMPLOYEE = 0.12
PF_RATE_EMPLOYER = 0.12
PF_WAGE_CEILING = 15000          # PF computed on min(basic+da, ceiling)

ESI_RATE_EMPLOYEE = 0.0075
ESI_RATE_EMPLOYER = 0.0325
ESI_GROSS_CEILING = 21000        # ESI applies only while gross <= ceiling

STD_DEDUCTION = 50000            # income-tax standard deduction (new regime)

EARNING_KEYS = ["basic", "hra", "da", "conveyance", "medical", "special",
                "bonus", "overtime", "arrears", "other"]
DEDUCTION_KEYS = ["pf", "esi", "pt", "tds", "loan", "advance", "lop", "other"]


def _money(x) -> float:
    return round(float(x or 0), 2)


def gross_of(earnings: dict) -> float:
    return _money(sum(float(earnings.get(k) or 0) for k in EARNING_KEYS))


def professional_tax(gross_monthly: float) -> float:
    """Generic monthly PT slab (Maharashtra-style; tweak per state)."""
    g = gross_monthly
    if g <= 7500:
        return 0.0
    if g <= 10000:
        return 175.0
    return 200.0


def estimate_tds(gross_monthly: float) -> float:
    """Rough monthly TDS under the new regime, annualising the monthly gross.
    Returns 0 when projected tax is nil. Employers can override with an actual
    figure from the employee's tax declaration."""
    annual = gross_monthly * 12 - STD_DEDUCTION
    if annual <= 700000:        # 87A rebate => no tax up to 7L taxable
        return 0.0
    slabs = [
        (300000, 0.0), (700000, 0.05), (1000000, 0.10),
        (1200000, 0.15), (1500000, 0.20), (float("inf"), 0.30),
    ]
    tax, lower = 0.0, 0.0
    for upper, rate in slabs:
        if annual > lower:
            tax += (min(annual, upper) - lower) * rate
            lower = upper
        else:
            break
    tax *= 1.04   # 4% health & education cess
    return _money(tax / 12)


def compute(earnings: dict, *, overrides: dict | None = None,
            auto_statutory: bool = True, lop_amount: float = 0.0) -> dict:
    """Return a fully-costed payroll breakdown.

    `overrides` may pin any deduction (pf/esi/pt/tds/loan/advance/lop/other);
    anything not overridden is auto-computed when auto_statutory is True.
    """
    overrides = overrides or {}
    earnings = {k: _money(earnings.get(k)) for k in EARNING_KEYS if earnings.get(k)}
    gross = gross_of(earnings)
    basic = _money(earnings.get("basic"))
    da = _money(earnings.get("da"))
    pf_base = min(basic + da, PF_WAGE_CEILING)

    ded: dict = {}

    def pick(key, auto_value):
        if key in overrides and overrides[key] not in (None, ""):
            return _money(overrides[key])
        return _money(auto_value) if auto_statutory else 0.0

    ded["pf"] = pick("pf", pf_base * PF_RATE_EMPLOYEE)
    in_esi = gross <= ESI_GROSS_CEILING
    ded["esi"] = pick("esi", gross * ESI_RATE_EMPLOYEE if in_esi else 0.0)
    ded["pt"] = pick("pt", professional_tax(gross))
    ded["tds"] = pick("tds", estimate_tds(gross))
    # Non-statutory: only what was passed in.
    for k in ("loan", "advance", "other"):
        if overrides.get(k):
            ded[k] = _money(overrides[k])
    if lop_amount:
        ded["lop"] = _money(lop_amount)
    elif overrides.get("lop"):
        ded["lop"] = _money(overrides["lop"])

    ded = {k: v for k, v in ded.items() if v}
    total_ded = _money(sum(ded.values()))

    employer_pf = _money(pf_base * PF_RATE_EMPLOYER)
    employer_esi = _money(gross * ESI_RATE_EMPLOYER if in_esi else 0.0)

    return {
        "earnings": earnings,
        "deductions_detail": ded,
        "gross_earnings": gross,
        "total_deductions": total_ded,
        "net_salary": _money(gross - total_ded),
        "employer_pf": employer_pf,
        "employer_esi": employer_esi,
    }
