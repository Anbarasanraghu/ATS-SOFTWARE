import { useRef, useState } from "react";
import { Barcode as BarcodeIcon, Camera } from "lucide-react";
import CameraScanner from "./LazyCameraScanner";
import { beep } from "../lib/sound";

/**
 * Reusable barcode scan field. A USB/Bluetooth scanner types the code and
 * presses Enter automatically — so on Enter we fire onScan() and clear.
 * The camera button opens the device camera to scan a barcode (no hardware
 * scanner needed). Used in Inventory, Barcode labels, POS-style flows, and any
 * future module (e.g. medical / pharmacy).
 */
export default function ScanInput({
  onScan, placeholder = "Scan barcode / SKU…", autoFocus = false, className = "", camera = true,
}: {
  onScan: (code: string) => void | Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  camera?: boolean;
}) {
  const [value, setValue] = useState("");
  const [cam, setCam] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  async function fire(code?: string) {
    const c = (code ?? value).trim();
    if (!c || busy.current) return;
    busy.current = true;
    setValue("");
    beep();   // beep on every read (USB/keyboard), like a supermarket scanner
    try { await onScan(c); } finally { busy.current = false; ref.current?.focus(); }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
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
      {camera && (
        <button type="button" onClick={() => setCam(true)} title="Scan with camera"
          className="shrink-0 rounded-md border border-line px-2.5 py-2 hover:bg-line/50">
          <Camera size={16} />
        </button>
      )}
      {cam && <CameraScanner continuous={false} onDetect={(code) => void fire(code)} onClose={() => setCam(false)} />}
    </div>
  );
}
