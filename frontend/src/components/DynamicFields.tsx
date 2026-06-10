import type { FieldDef } from "../lib/api";

const optVal = (o: FieldDef["options"][number]) => (typeof o === "string" ? o : o.value);

export default function DynamicFields({
  defs, values, onChange,
}: {
  defs: FieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (defs.length === 0) return null;
  const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent";

  return (
    <div className="space-y-3 border border-dashed border-line rounded-md p-4 bg-paper/40">
      <div className="text-xs uppercase tracking-wide text-muted">Custom fields</div>
      {defs.map((d) => {
        const v = values[d.field_key];
        if (d.data_type === "boolean")
          return (
            <label key={d.field_key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(v)}
                onChange={(e) => onChange(d.field_key, e.target.checked)} />
              {d.label}{d.is_required && <span className="text-danger"> *</span>}
            </label>
          );
        if (d.data_type === "multiselect") {
          const selected = Array.isArray(v) ? (v as string[]) : [];
          return (
            <fieldset key={d.field_key} className="block">
              <legend className="text-xs font-medium uppercase tracking-wide text-muted">
                {d.label}{d.is_required && <span className="text-danger"> *</span>}
              </legend>
              <div className="mt-1 flex flex-wrap gap-3 rounded-md border border-line bg-paper px-3 py-2">
                {d.options.map((o) => {
                  const val = optVal(o);
                  return (
                    <label key={val} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={selected.includes(val)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selected, val]
                            : selected.filter((s) => s !== val);
                          onChange(d.field_key, next);
                        }} />
                      {val}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        }

        return (
          <label key={d.field_key} className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              {d.label}{d.is_required && <span className="text-danger"> *</span>}
            </span>
            {d.data_type === "select" ? (
              <select className={inputCls} value={(v as string) ?? ""}
                onChange={(e) => onChange(d.field_key, e.target.value)}>
                <option value="">—</option>
                {d.options.map((o) => <option key={optVal(o)} value={optVal(o)}>{optVal(o)}</option>)}
              </select>
            ) : (
              <input type={d.data_type === "number" ? "number" : d.data_type === "date" ? "date" : "text"}
                className={inputCls} value={(v as string) ?? ""}
                onChange={(e) => onChange(d.field_key, e.target.value)} />
            )}
          </label>
        );
      })}
    </div>
  );
}