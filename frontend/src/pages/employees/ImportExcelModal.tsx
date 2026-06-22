import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { X, FileSpreadsheet, CheckCircle, Download, AlertTriangle } from "lucide-react";
import { api, type Employee } from "../../lib/api";

interface ParsedRow {
  employee_no: string;
  full_name: string;
  phone: string;
  email: string;
  department: string;
  designation: string;
  work_location: string;
  hire_date: string;
  salary: string;
  annual_leave_balance: string;
  status: string;
  _row: number;
  _errors: string[];
  _dup: boolean;
}

const FIELD_MAP: [string[], string][] = [
  [["employee id","employee_id","employeeid","emp id","emp_id","empid","id"], "employee_no"],
  [["employee name","name","full name","full_name","fullname","employee"], "full_name"],
  [["phone","mobile","phone number","mobile number","contact","contact no"], "phone"],
  [["email","email address","e-mail"], "email"],
  [["department","dept","department name"], "department"],
  [["designation","job title","job_title","position","role"], "designation"],
  [["work location","work_location","location","office","office location"], "work_location"],
  [["hire date","hire_date","joining date","join date","date of joining","doj","joined"], "hire_date"],
  [["salary","basic salary","basic","ctc","pay"], "salary"],
  [["leave balance","leave_balance","annual leave","leaves","leave"], "annual_leave_balance"],
  [["status","employment status"], "status"],
];

function mapHeader(h: string): string | null {
  const n = h.trim().toLowerCase();
  for (const [aliases, field] of FIELD_MAP) {
    if (aliases.includes(n)) return field;
  }
  return null;
}

interface Props {
  existingEmployees: Employee[];
  onClose: () => void;
  onImported: () => void;
}

export function ImportExcelModal({ existingEmployees, onClose, onImported }: Props) {
  const [step, setStep]         = useState<"upload" | "preview" | "result">("upload");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState({ imported: 0, skipped: 0, errors: 0 });
  const [failedRows, setFailedRows] = useState<ParsedRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = useCallback(async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    if (raw.length < 2) return;

    const headers = (raw[0] as unknown[]).map(h => String(h ?? ""));
    const colMap: Record<number, string> = {};
    headers.forEach((h, i) => { const f = mapHeader(h); if (f) colMap[i] = f; });

    const existingNos   = new Set(existingEmployees.map(e => e.employee_no?.toLowerCase().trim()).filter(Boolean));
    const existingPhones = new Set(existingEmployees.map(e => e.phone?.replace(/\D/g, "")).filter(Boolean));

    const parsed: ParsedRow[] = [];
    for (let ri = 1; ri < raw.length; ri++) {
      const row = raw[ri] as unknown[];
      if (!row || row.every(c => c == null || String(c).trim() === "")) continue;

      const get = (field: string): string => {
        const idx = Object.entries(colMap).find(([, f]) => f === field)?.[0];
        if (idx === undefined) return "";
        const v = row[+idx];
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return v != null ? String(v).trim() : "";
      };

      const empNo  = get("employee_no");
      const name   = get("full_name");
      const phone  = get("phone");
      const errors: string[] = [];
      if (!empNo)  errors.push("Employee ID required");
      if (!name)   errors.push("Name required");
      if (!phone)  errors.push("Phone required");

      const cleanPhone = phone.replace(/\D/g, "");
      const dup = !!(
        (empNo  && existingNos.has(empNo.toLowerCase())) ||
        (cleanPhone && existingPhones.has(cleanPhone))
      );

      parsed.push({
        employee_no:          empNo,
        full_name:            name,
        phone,
        email:                get("email"),
        department:           get("department"),
        designation:          get("designation"),
        work_location:        get("work_location"),
        hire_date:            get("hire_date"),
        salary:               get("salary"),
        annual_leave_balance: get("annual_leave_balance"),
        status:               get("status") || "active",
        _row: ri + 1, _errors: errors, _dup: dup,
      });
    }
    setRows(parsed);
    setStep("preview");
  }, [existingEmployees]);

  function handleFile(file: File) {
    if (!/\.(xlsx|csv)$/i.test(file.name)) { alert("Please select a .xlsx or .csv file"); return; }
    parse(file);
  }

  async function doImport() {
    const valid = rows.filter(r => r._errors.length === 0 && !r._dup);
    setImporting(true);
    let imported = 0;
    const failed: ParsedRow[] = [];

    for (const r of valid) {
      try {
        await api.createEmployee({
          employee_no:          r.employee_no || null,
          full_name:            r.full_name,
          phone:                r.phone || null,
          email:                r.email || null,
          department:           r.department || null,
          designation:          r.designation || null,
          job_title:            r.designation || null,
          work_location:        r.work_location || null,
          hire_date:            r.hire_date || null,
          salary:               r.salary ? parseFloat(r.salary) : null,
          annual_leave_balance: r.annual_leave_balance ? parseFloat(r.annual_leave_balance) : 0,
          status:               ["active","inactive","on_leave","terminated"].includes(r.status) ? r.status : "active",
          custom_fields: {}, family_details: {}, insurance_details: {}, system_details: {},
        });
        imported++;
      } catch {
        failed.push(r);
      }
    }

    const skipped = rows.filter(r => r._dup).length;
    const errors  = rows.filter(r => r._errors.length > 0).length + failed.length;
    setResult({ imported, skipped, errors });
    setFailedRows([...rows.filter(r => r._errors.length > 0), ...failed]);
    setImporting(false);
    setStep("result");
    if (imported > 0) onImported();
  }

  function downloadErrors() {
    const data = failedRows.map(r => ({
      "Row #":       r._row,
      "Employee ID": r.employee_no,
      "Name":        r.full_name,
      "Phone":       r.phone,
      "Email":       r.email,
      "Issue":       r._errors.join(", ") || (r._dup ? "Duplicate" : "Import failed"),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "import-errors.xlsx");
  }

  const validCount = rows.filter(r => r._errors.length === 0 && !r._dup).length;
  const dupCount   = rows.filter(r => r._dup).length;
  const errCount   = rows.filter(r => r._errors.length > 0).length;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-paper rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink">Import Employees</h2>
            <p className="text-xs text-muted mt-0.5">Upload .xlsx or .csv file to bulk import employees</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 rounded-lg hover:bg-line/40">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* STEP: Upload */}
          {step === "upload" && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  dragging ? "border-accent bg-accent/5 scale-[1.01]" : "border-line hover:border-accent/50 hover:bg-surface"
                }`}
              >
                <FileSpreadsheet size={40} className={`mx-auto mb-3 ${dragging ? "text-accent" : "text-muted"}`} />
                <p className="text-sm font-medium text-ink">Drop your Excel or CSV file here</p>
                <p className="text-xs text-muted mt-1">or click to browse &nbsp;·&nbsp; Supports .xlsx and .csv</p>
                <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </div>

              <div className="bg-surface border border-line rounded-xl p-4">
                <p className="text-xs font-semibold text-ink mb-3">Expected columns <span className="text-danger">*</span> = required:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Employee ID", req: true }, { label: "Employee Name", req: true },
                    { label: "Phone", req: true }, { label: "Email", req: false },
                    { label: "Department", req: false }, { label: "Designation", req: false },
                    { label: "Work Location", req: false }, { label: "Hire Date", req: false },
                    { label: "Salary", req: false }, { label: "Leave Balance", req: false },
                    { label: "Status", req: false },
                  ].map(({ label, req }) => (
                    <span key={label} className={`text-xs px-2.5 py-1 rounded-full border ${
                      req ? "bg-accent/10 text-accent border-accent/20 font-medium" : "bg-line/40 text-muted border-line"
                    }`}>
                      {label}{req ? " *" : ""}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* STEP: Preview */}
          {step === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{fileName}</p>
                  <p className="text-xs text-muted">{rows.length} rows found</p>
                </div>
                <div className="flex gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1 text-green-600">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {validCount} ready
                  </span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {dupCount} duplicate
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {errCount} error
                  </span>
                </div>
              </div>

              <div className="border border-line rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface border-b border-line">
                      <tr>
                        {["Row","Emp ID","Name","Phone","Department","Designation","Status"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-muted font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={`border-b border-line/40 last:border-0 ${
                          r._errors.length > 0 ? "bg-red-50/60" : r._dup ? "bg-amber-50/60" : "hover:bg-surface/50"
                        }`}>
                          <td className="px-3 py-2 text-muted">{r._row}</td>
                          <td className="px-3 py-2 font-medium">{r.employee_no || "—"}</td>
                          <td className="px-3 py-2 font-medium text-ink">{r.full_name || "—"}</td>
                          <td className="px-3 py-2">{r.phone || "—"}</td>
                          <td className="px-3 py-2">{r.department || "—"}</td>
                          <td className="px-3 py-2">{r.designation || "—"}</td>
                          <td className="px-3 py-2">
                            {r._errors.length > 0 ? (
                              <span className="text-red-600 font-medium">✗ {r._errors[0]}</span>
                            ) : r._dup ? (
                              <span className="text-amber-600 font-medium">⚠ Duplicate</span>
                            ) : (
                              <span className="text-green-600 font-medium">✓ Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dupCount > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {dupCount} row{dupCount !== 1 ? "s" : ""} match existing employees (by Employee ID or Phone) and will be skipped.
                </div>
              )}
            </>
          )}

          {/* STEP: Result */}
          {step === "result" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                  <p className="text-3xl font-bold text-green-700">{result.imported}</p>
                  <p className="text-xs text-green-600 mt-1 font-medium">Imported</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                  <p className="text-3xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600 mt-1 font-medium">Skipped (Duplicates)</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                  <p className="text-3xl font-bold text-red-700">{result.errors}</p>
                  <p className="text-xs text-red-600 mt-1 font-medium">Errors</p>
                </div>
              </div>

              {result.imported > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle size={16} className="shrink-0" />
                  Successfully imported {result.imported} employee{result.imported !== 1 ? "s" : ""}. The employee list has been updated.
                </div>
              )}

              {failedRows.length > 0 && (
                <div className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between">
                  <p className="text-sm text-ink">
                    {failedRows.length} row{failedRows.length !== 1 ? "s" : ""} had issues and were not imported.
                  </p>
                  <button onClick={downloadErrors}
                    className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium">
                    <Download size={13} /> Download error report
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line">
          {step === "preview" && (
            <button onClick={() => { setStep("upload"); setRows([]); setFileName(""); }}
              className="px-4 py-2 text-sm border border-line rounded-lg text-muted hover:text-ink">
              Change File
            </button>
          )}
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-line rounded-lg text-muted hover:text-ink">
            {step === "result" ? "Close" : "Cancel"}
          </button>
          {step === "preview" && (
            <button onClick={doImport} disabled={validCount === 0 || importing}
              className="px-5 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 font-medium">
              {importing ? "Importing…" : `Import ${validCount} Employee${validCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
