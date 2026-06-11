import { useRef, useState } from "react";
import { Barcode as BarcodeIcon } from "lucide-react";

/**
 * Reusable barcode scan field. A USB/Bluetooth scanner types the code and
 * presses Enter automatically — so on Enter we fire onScan() and clear.
 * Used in Inventory, Barcode labels, POS-style flows, and any future module
 * (e.g. medical / pharmacy) that needs "scan to find / add".
 */
export default function ScanInput({
  onScan, placeholder = "Scan barcode / SKU…", autoFocus = false, className = "",
}: {
  onScan: (code: string) => void | Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  async function fire() {
    const code = value.trim();
    if (!code || busy.current) return;
    busy.current = true;
    setValue("");
    try { await onScan(code); } finally { busy.current = false; ref.current?.focus(); }
  }

  return (
    <div className={`relative ${className}`}>
      <BarcodeIcon size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        autoFocus={autoFocus}
        className="w-full rounded-md border-2 border-accent/60 bg-paper pl-8 pr-3 py-2 text-sm font-mono outline-none focus:border-accent"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void fire(); } }}
      />
    </div>
  );
}
