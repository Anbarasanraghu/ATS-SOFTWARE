import { useCallback, useEffect, useState } from "react";
import { Plus, X, Trash2, CheckCircle, IndianRupee, Pencil, FileText, Printer, Play } from "lucide-react";
import { api, type Employee, type PayrollRecord, type PayrollSummary, type Payslip } from "../lib/api";
import { money } from "../lib/money";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600", approved: "bg-sky-100 text-sky-700", paid: "bg-emerald-100 text-emerald-700",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const EARNINGS: [string, string][] = [
  ["basic","Basic"],["hra","HRA"],["da","DA"],["conveyance","Conveyance"],
  ["medical","Medical"],["special","Special"],["bonus","Bonus"],["overtime","Overtime"],["other","Other"],
];
const DEDUCTIONS: [string, string][] = [
  ["pf","PF"],["esi","ESI"],["pt","Prof. Tax"],["tds","TDS"],["loan","Loan"],["advance","Advance"],
];
const now = new Date();
const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

type PForm = {
  id?: string; employee_id: string; period_month: string; period_year: string;
  earnings: Record<string, string>; deductions: Record<string, string>;
  working_days: string; paid_days: string; auto_statutory: boolean; notes: string;
};
const blankForm = (): PForm => ({
  id: undefined, employee_id: "", period_month: String(now.getMonth() + 1), period_year: String(now.getFullYear()),
  earnings: {}, deductions: {}, working_days: "", paid_days: "", auto_statutory: true, notes: "",
});
const toNumMap = (m: Record<string, string>) => {
  const o: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) if (v !== "" && Number(v)) o[k] = Number(v);
  return o;
};
const strMap = (m: Record<string, number>) => {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(m || {})) o[k] = String(v);
  return o;
};

export default function PayrollPage() {
  const [records, setRecords]     = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary]     = useState<PayrollSummary | null>(null);
  const [fMonth, setFMonth]       = useState<string>(String(now.getMonth() + 1));
  const [fYear, setFYear]         = useState<string>(String(now.getFullYear()));
  const [fStatus, setFStatus]     = useState<string>("");
  const [error, setError]         = useState<string | null>(null);

  const [form, setForm]           = useState<PForm | null>(null);   // create/edit modal
  const [runOpen, setRunOpen]     = useState(false);
  const [runForm, setRunForm]     = useState({ working_days: "", auto_statutory: true, overwrite: false });
  const [payFor, setPayFor]       = useState<PayrollRecord | null>(null);
  const [payForm, setPayForm]     = useState({ payment_method: "bank_transfer", payment_reference: "", paid_on: new Date().toISOString().slice(0, 10) });
  const [slip, setSlip]           = useState<Payslip | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        api.listPayroll({ month: Number(fMonth) || undefined, year: Number(fYear) || undefined, status_f: fStatus || undefined }),
        api.listEmployees(),
      ]);
      setRecords(r); setEmployees(e); setLoadError(null);
      if (fMonth && fYear) { try { setSummary(await api.payrollSummary(Number(fMonth), Number(fYear))); } catch { setSummary(null); } }
      else setSummary(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load payroll";
      setLoadError(/admin|manager|forbidden|403/i.test(msg)
        ? "Payroll needs an admin/manager role. Please sign out and sign in again to refresh your session."
        : msg);
      setRecords([]);
    }
  }, [fMonth, fYear, fStatus]);
  useEffect(() => { void refresh(); }, [refresh]);

  function openCreate() {
    setError(null); setForm(blankForm());
  }
  function openEdit(r: PayrollRecord) {
    setError(null);
    setForm({
      id: r.id, employee_id: r.employee_id, period_month: String(r.period_month), period_year: String(r.period_year),
      earnings: strMap(r.earnings), deductions: strMap(r.deductions_detail),
      working_days: r.working_days != null ? String(r.working_days) : "",
      paid_days: r.paid_days != null ? String(r.paid_days) : "",
      auto_statutory: true, notes: r.notes ?? "",
    });
  }
  function pickEmployee(id: string) {
    const emp = employees.find((e) => e.id === id);
    const ss = emp?.salary_structure && Object.keys(emp.salary_structure).length
      ? strMap(emp.salary_structure)
      : (emp?.salary ? { basic: String(emp.salary) } : {});
    setForm((f) => f && { ...f, employee_id: id, earnings: ss });
  }

  const grossPreview = form ? Object.values(form.earnings).reduce((s, v) => s + (Number(v) || 0), 0) : 0;

  async function submitForm(e: { preventDefault(): void }) {
    e.preventDefault(); if (!form) return; setError(null);
    if (!form.employee_id) { setError("Select an employee."); return; }
    const payload = {
      employee_id: form.employee_id, period_month: Number(form.period_month), period_year: Number(form.period_year),
      earnings: toNumMap(form.earnings), deductions: toNumMap(form.deductions),
      working_days: form.working_days ? Number(form.working_days) : null,
      paid_days: form.paid_days ? Number(form.paid_days) : null,
      auto_statutory: form.auto_statutory, notes: form.notes || null,
    };
    try {
      if (form.id) await api.updatePayroll(form.id, payload);
      else await api.createPayroll(payload);
      setForm(null); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function runPayroll(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    try {
      const res = await api.runPayroll({
        period_month: Number(fMonth), period_year: Number(fYear),
        working_days: runForm.working_days ? Number(runForm.working_days) : null,
        auto_statutory: runForm.auto_statutory, overwrite: runForm.overwrite,
      });
      setRunOpen(false);
      alert(`Payroll run complete — ${res.created} created, ${res.skipped} skipped.`);
      await refresh();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function setStatus(id: string, status: string) {
    try { await api.updatePayrollStatus(id, { status }); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function submitPay(e: { preventDefault(): void }) {
    e.preventDefault(); if (!payFor) return;
    try {
      await api.updatePayrollStatus(payFor.id, { status: "paid", ...payForm });
      setPayFor(null); await refresh();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this payroll record?")) return;
    try { await api.deletePayroll(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function openSlip(id: string) {
    try { setSlip(await api.payslip(id)); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <style>{`@media print { body * { visibility: hidden !important; } #payslip, #payslip * { visibility: visible !important; } #payslip { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>

      <div className="flex items-center gap-3 flex-wrap no-print">
        <h1 className="text-xl font-semibold">Payroll</h1>
        <div className="ml-auto flex items-center gap-2">
          <select className="rounded-md border border-line bg-paper px-2 py-2 text-sm" value={fMonth} onChange={(e) => setFMonth(e.target.value)}>
            {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
          </select>
          <input className="w-20 rounded-md border border-line bg-paper px-2 py-2 text-sm" value={fYear} onChange={(e) => setFYear(e.target.value)} />
          <select className="rounded-md border border-line bg-paper px-2 py-2 text-sm" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">All status</option><option value="draft">Draft</option><option value="approved">Approved</option><option value="paid">Paid</option>
          </select>
          <button onClick={() => setRunOpen(true)} className="flex items-center gap-1 rounded-md border border-accent text-accent px-3 py-2 text-sm font-medium hover:bg-accent-soft">
            <Play size={15} /> Run payroll
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {loadError && (
        <div className="no-print rounded-md border border-danger/30 bg-danger/10 text-danger text-sm px-4 py-3">
          {loadError}
        </div>
      )}

      {/* Summary cards for the selected period */}
      {summary && summary.count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 no-print">
          {([["Net payable", summary.net], ["Gross", summary.gross], ["Deductions", summary.deductions],
             ["PF (EE)", summary.pf_total], ["ESI (EE)", summary.esi_total], ["PT", summary.pt_total],
             ["TDS", summary.tds_total], ["CTC", summary.ctc]] as [string, number][]).map(([label, val]) => (
            <div key={label} className="bg-surface border border-line rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
              <div className="text-sm font-semibold mt-0.5 font-mono">{money(val)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg overflow-x-auto no-print">
        {records.length === 0 ? (
          <p className="p-6 text-sm text-muted">No payroll records for this filter. Use <b>Run payroll</b> to generate the month, or <b>New</b> for a single record.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net</th><th className="px-4 py-3 text-center">LOP</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3 font-medium">{r.employee_name}</td>
                  <td className="px-4 py-3 text-muted">{MONTHS[r.period_month - 1]} {r.period_year}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(r.gross_earnings)}</td>
                  <td className="px-4 py-3 text-right font-mono text-danger">-{money(r.total_deductions)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{money(r.net_salary)}</td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{r.lop_days ? `${r.lop_days}d` : "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[r.status] ?? ""}`}>{r.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openSlip(r.id)} className="text-muted hover:text-accent" title="Payslip"><FileText size={15} /></button>
                      {r.status !== "paid" && <button onClick={() => openEdit(r)} className="text-muted hover:text-accent" title="Edit"><Pencil size={14} /></button>}
                      {r.status === "draft" && <button onClick={() => setStatus(r.id, "approved")} className="text-muted hover:text-sky-600" title="Approve"><CheckCircle size={15} /></button>}
                      {r.status === "approved" && <button onClick={() => { setPayFor(r); setPayForm({ payment_method: "bank_transfer", payment_reference: "", paid_on: new Date().toISOString().slice(0, 10) }); }} className="text-muted hover:text-emerald-600" title="Mark paid"><IndianRupee size={15} /></button>}
                      {r.status !== "paid" && <button onClick={() => remove(r.id)} className="text-muted hover:text-danger" title="Delete"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / edit modal */}
      {form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={submitForm} className="bg-surface border border-line rounded-lg p-6 w-full max-w-2xl space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{form.id ? "Edit Payroll" : "New Payroll Record"}</h2>
              <button type="button" onClick={() => setForm(null)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <label className="block col-span-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Employee *</span>
                <select required disabled={!!form.id} className={inputCls} value={form.employee_id} onChange={(e) => pickEmployee(e.target.value)}>
                  <option value="">— Select —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select></label>
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Month</span>
                <select disabled={!!form.id} className={inputCls} value={form.period_month} onChange={(e) => setForm({ ...form, period_month: e.target.value })}>
                  {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                </select></label>
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Year</span>
                <input type="number" disabled={!!form.id} className={inputCls} value={form.period_year} onChange={(e) => setForm({ ...form, period_year: e.target.value })} /></label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Earnings</div>
                <div className="grid grid-cols-2 gap-2">
                  {EARNINGS.map(([k, label]) => (
                    <label key={k} className="block"><span className="text-[11px] text-muted">{label}</span>
                      <input type="number" step="0.01" className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm outline-none focus:border-accent"
                        value={form.earnings[k] ?? ""} onChange={(e) => setForm({ ...form, earnings: { ...form.earnings, [k]: e.target.value } })} /></label>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Deductions</div>
                  <label className="flex items-center gap-1 text-[11px] text-muted">
                    <input type="checkbox" checked={form.auto_statutory} onChange={(e) => setForm({ ...form, auto_statutory: e.target.checked })} /> auto PF/ESI/PT/TDS
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEDUCTIONS.map(([k, label]) => (
                    <label key={k} className="block"><span className="text-[11px] text-muted">{label}{["pf","esi","pt","tds"].includes(k) && form.auto_statutory ? " (auto)" : ""}</span>
                      <input type="number" step="0.01" placeholder={["pf","esi","pt","tds"].includes(k) && form.auto_statutory ? "auto" : ""}
                        className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm outline-none focus:border-accent"
                        value={form.deductions[k] ?? ""} onChange={(e) => setForm({ ...form, deductions: { ...form.deductions, [k]: e.target.value } })} /></label>
                  ))}
                  <label className="block"><span className="text-[11px] text-muted">Working days</span>
                    <input type="number" step="0.5" className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm outline-none focus:border-accent" value={form.working_days} onChange={(e) => setForm({ ...form, working_days: e.target.value })} /></label>
                  <label className="block"><span className="text-[11px] text-muted">Paid days (LOP)</span>
                    <input type="number" step="0.5" className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm outline-none focus:border-accent" value={form.paid_days} onChange={(e) => setForm({ ...form, paid_days: e.target.value })} /></label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-paper/60 rounded-md px-3 py-2 text-sm">
              <span className="text-muted">Gross (entered)</span>
              <span className="font-mono font-semibold">{money(grossPreview)}</span>
            </div>
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Notes</span>
              <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <p className="text-xs text-muted">Statutory deductions (PF/ESI/PT/TDS) and employer contributions are computed on save. Leave those blank to auto-calculate, or enter a value to override.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">{form.id ? "Save" : "Create"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Run payroll modal */}
      {runOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={runPayroll} className="bg-surface border border-line rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Run payroll — {MONTHS[Number(fMonth) - 1]} {fYear}</h2>
              <button type="button" onClick={() => setRunOpen(false)} className="text-muted hover:text-ink"><X size={18} /></button></div>
            <p className="text-xs text-muted">Generates a draft record for every active employee using their salary structure, auto-computing statutory deductions and LOP from approved unpaid leave.</p>
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Working days (blank = days in month)</span>
              <input type="number" step="0.5" className={inputCls} value={runForm.working_days} onChange={(e) => setRunForm({ ...runForm, working_days: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={runForm.auto_statutory} onChange={(e) => setRunForm({ ...runForm, auto_statutory: e.target.checked })} /> Auto statutory (PF/ESI/PT/TDS)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={runForm.overwrite} onChange={(e) => setRunForm({ ...runForm, overwrite: e.target.checked })} /> Overwrite existing drafts</label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRunOpen(false)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">Run</button>
            </div>
          </form>
        </div>
      )}

      {/* Pay modal */}
      {payFor && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={submitPay} className="bg-surface border border-line rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Mark paid — {payFor.employee_name}</h2>
              <button type="button" onClick={() => setPayFor(null)} className="text-muted hover:text-ink"><X size={18} /></button></div>
            <div className="text-sm text-muted">Net: <span className="font-mono font-semibold text-ink">{money(payFor.net_salary)}</span></div>
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Method</span>
              <select className={inputCls} value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}>
                <option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option>
              </select></label>
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Reference</span>
              <input className={inputCls} value={payForm.payment_reference} onChange={(e) => setPayForm({ ...payForm, payment_reference: e.target.value })} /></label>
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Paid on</span>
              <input type="date" className={inputCls} value={payForm.paid_on} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} /></label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setPayFor(null)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white font-medium">Confirm payment</button>
            </div>
          </form>
        </div>
      )}

      {/* Payslip modal (printable) */}
      {slip && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black rounded-lg w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b no-print">
              <span className="font-semibold">Payslip</span>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-1 rounded-md bg-accent text-white px-3 py-1.5 text-sm"><Printer size={14} /> Print</button>
                <button onClick={() => setSlip(null)} className="text-muted hover:text-ink"><X size={18} /></button>
              </div>
            </div>
            <div id="payslip" className="p-6 text-sm">
              <div className="text-center border-b pb-3 mb-3">
                <div className="text-lg font-bold">{slip.company.name}</div>
                <div className="text-xs text-zinc-500">Payslip for {MONTHS[slip.record.period_month - 1]} {slip.record.period_year}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-4">
                <div><b>Employee:</b> {slip.employee.full_name}</div>
                <div><b>Emp No:</b> {slip.employee.employee_no ?? "—"}</div>
                <div><b>Designation:</b> {slip.employee.designation ?? "—"}</div>
                <div><b>Department:</b> {slip.employee.department ?? "—"}</div>
                <div><b>PAN:</b> {slip.employee.pan ?? "—"}</div>
                <div><b>UAN:</b> {slip.employee.uan ?? "—"}</div>
                <div><b>Bank:</b> {slip.employee.bank_name ?? "—"} {slip.employee.bank_account ?? ""}</div>
                <div><b>Paid days:</b> {slip.record.paid_days ?? slip.record.working_days ?? "—"} {slip.record.lop_days ? `(LOP ${slip.record.lop_days})` : ""}</div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="font-semibold border-b mb-1">Earnings</div>
                  {Object.entries(slip.record.earnings).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-mono">{money(v)}</span></div>
                  ))}
                  <div className="flex justify-between font-semibold border-t mt-1 pt-1"><span>Gross</span><span className="font-mono">{money(slip.record.gross_earnings)}</span></div>
                </div>
                <div>
                  <div className="font-semibold border-b mb-1">Deductions</div>
                  {Object.entries(slip.record.deductions_detail).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="uppercase">{k}</span><span className="font-mono">{money(v)}</span></div>
                  ))}
                  <div className="flex justify-between font-semibold border-t mt-1 pt-1"><span>Total</span><span className="font-mono">{money(slip.record.total_deductions)}</span></div>
                </div>
              </div>
              <div className="flex justify-between items-center bg-zinc-100 rounded px-3 py-2 mt-4 font-bold">
                <span>Net Pay</span><span className="font-mono">{money(slip.record.net_salary)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-xs text-zinc-600">
                <div><b>Employer PF:</b> {money(slip.record.employer_pf)}</div>
                <div><b>Employer ESI:</b> {money(slip.record.employer_esi)}</div>
                <div><b>Status:</b> {slip.record.status}{slip.record.paid_on ? ` · ${slip.record.paid_on}` : ""}</div>
              </div>
              <div className="border-t mt-3 pt-2 text-xs text-zinc-600">
                <b>YTD ({slip.ytd.financial_year}):</b> Gross {money(slip.ytd.gross)} · Deductions {money(slip.ytd.deductions)} · Net {money(slip.ytd.net)}
              </div>
              <div className="text-[10px] text-zinc-400 text-center mt-4">This is a computer-generated payslip.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
