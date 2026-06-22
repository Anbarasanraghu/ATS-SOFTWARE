import { useRef, useState } from "react";
import { X, Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../../lib/api";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow {
  name: string; company: string; phone: string; whatsapp: string;
  email: string; address: string; source: string; interested_service: string;
  priority: string; assigned_staff: string; notes: string;
}

function parseRows(ws: XLSX.WorkSheet): ParsedRow[] {
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  return raw.map(r => ({
    name: String(r["name"] || r["Name"] || r["Customer Name"] || "").trim(),
    company: String(r["company"] || r["Company"] || "").trim(),
    phone: String(r["phone"] || r["Phone"] || r["Phone Number"] || "").trim(),
    whatsapp: String(r["whatsapp"] || r["WhatsApp"] || "").trim(),
    email: String(r["email"] || r["Email"] || "").trim(),
    address: String(r["address"] || r["Address"] || "").trim(),
    source: String(r["source"] || r["Source"] || "").trim(),
    interested_service: String(r["interested_service"] || r["Interested Service"] || "").trim(),
    priority: String(r["priority"] || r["Priority"] || "medium").toLowerCase().trim() || "medium",
    assigned_staff: String(r["assigned_staff"] || r["Assigned Staff"] || "").trim(),
    notes: String(r["notes"] || r["Notes"] || "").trim(),
  })).filter(r => r.name);
}

export default function ImportCustomersModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [done, setDone] = useState(false);

  function handleFile(f: File) {
    setFile(f); setParseError(null); setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseRows(ws);
        if (parsed.length === 0) {
          setParseError("No valid rows found. Make sure the file has a 'name' column.");
        } else {
          setRows(parsed);
        }
      } catch {
        setParseError("Could not parse the file. Please use the template format.");
      }
    };
    reader.readAsBinaryString(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "company", "phone", "whatsapp", "email", "address", "source", "interested_service", "priority", "assigned_staff", "notes"],
      ["John Doe", "Acme Corp", "9876543210", "9876543210", "john@acme.com", "Chennai", "Website", "CRM Software", "medium", "Ravi", "Interested in billing module"],
      ["Jane Smith", "Tech Ltd", "9123456789", "", "jane@tech.com", "Bangalore", "Reference", "Website Development", "high", "Priya", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "customers_import_template.xlsx");
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    let errors = 0;
    setProgress({ done: 0, total: rows.length, errors: 0 });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await api.createCustomer({
          name: row.name,
          company: row.company || null,
          phone: row.phone || null,
          whatsapp: row.whatsapp || null,
          email: row.email || null,
          address: row.address || null,
          source: row.source || null,
          interested_service: row.interested_service || null,
          priority: row.priority || "medium",
          assigned_staff: row.assigned_staff || null,
          notes: row.notes || null,
          crm_status: "new_lead",
          status: "active",
          tags: [],
          custom_fields: {},
        });
      } catch {
        errors++;
      }
      setProgress({ done: i + 1, total: rows.length, errors });
    }

    setImporting(false);
    setDone(true);
    setTimeout(() => { onImported(); onClose(); }, 2000);
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-line rounded-lg w-full max-w-lg shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-accent" />
            <div>
              <h2 className="font-semibold text-ink">Import Customers</h2>
              <p className="text-xs text-muted mt-0.5">Upload an Excel (.xlsx) or CSV file</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 rounded"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Template download */}
          <div className="flex items-center justify-between bg-accent-soft rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-accent">Download Import Template</p>
              <p className="text-xs text-muted mt-0.5">Use this template to format your data correctly</p>
            </div>
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium">
              <Download size={13} /> Template
            </button>
          </div>

          {/* File drop zone */}
          {!importing && !done && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-line rounded-lg p-6 text-center cursor-pointer hover:border-accent hover:bg-accent-soft/30 transition-colors">
              <Upload size={24} className="mx-auto text-muted/60 mb-2" />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-ink">{file.name}</p>
                  <p className="text-xs text-muted mt-1">{rows.length} valid rows found</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted">Drag & drop your file here, or click to browse</p>
                  <p className="text-xs text-muted/70 mt-1">Supports .xlsx and .csv</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !importing && !done && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Preview ({rows.length} rows)
              </p>
              <div className="border border-line rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-paper border-b border-line">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted">Name</th>
                      <th className="px-3 py-2 text-left text-muted">Phone</th>
                      <th className="px-3 py-2 text-left text-muted">Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b border-line/50 last:border-0">
                        <td className="px-3 py-1.5 text-ink">{r.name}</td>
                        <td className="px-3 py-1.5 text-muted">{r.phone || "—"}</td>
                        <td className="px-3 py-1.5 text-muted">{r.company || "—"}</td>
                      </tr>
                    ))}
                    {rows.length > 8 && (
                      <tr><td colSpan={3} className="px-3 py-1.5 text-muted text-center">…and {rows.length - 8} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Importing {progress.done} / {progress.total} customers…</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              {progress.errors > 0 && (
                <p className="text-xs text-amber-600">{progress.errors} row{progress.errors !== 1 ? "s" : ""} failed to import</p>
              )}
            </div>
          )}

          {/* Done */}
          {done && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              <div>
                <p className="font-medium">Import complete!</p>
                <p className="text-xs mt-0.5">
                  {progress.done - progress.errors} imported
                  {progress.errors > 0 ? `, ${progress.errors} failed` : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-line">
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50 text-ink">
            {done ? "Close" : "Cancel"}
          </button>
          {rows.length > 0 && !done && (
            <button onClick={handleImport} disabled={importing}
              className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium disabled:opacity-60 flex items-center gap-2">
              <Upload size={14} />
              {importing ? `Importing… (${pct}%)` : `Import ${rows.length} Customers`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
