import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Check, X } from "lucide-react";
import { beep } from "../lib/sound";

// Restrict to common retail symbologies — fewer formats = much faster decode.
const HINTS = new Map();
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
]);

/**
 * Camera barcode scanner. Prefers the rear camera (phones) but falls back to
 * any webcam (laptops), and lets the user switch cameras. Stays open and reads
 * one barcode after another (supermarket style) with a loud beep each time.
 * Calls onDetect(code) per new barcode (same code debounced). Needs HTTPS /
 * localhost for camera permission.
 */

export default function CameraScanner({
  onDetect, onClose, continuous = true, note,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
  continuous?: boolean;
  note?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError]     = useState<string | null>(null);
  const [count, setCount]     = useState(0);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const seenRef = useRef(0);     // last time ANY barcode was in frame
  const codeRef = useRef("");    // last accepted code

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(HINTS);
    let controls: { stop: () => void } | undefined;
    let cancelled = false;

    const onResult = (result: { getText(): string } | undefined) => {
      const now = Date.now();
      if (!result) return;                       // no barcode in frame this instant
      const gap = now - seenRef.current;          // time since last detection
      seenRef.current = now;
      const code = result.getText();
      // Accept when it's a DIFFERENT product (instant), or the SAME barcode that
      // left the frame and came back (gap). Holding one barcode still = ignored,
      // so it isn't added many times a second — but a quick away-and-back re-adds
      // it. No fixed wait → fast for many items and repeats.
      const reappeared = gap > 350;
      if (code === codeRef.current && !reappeared) return;
      codeRef.current = code;
      setCount((c) => c + 1);
      beep();
      onDetect(code);
      if (!continuous) { controls?.stop(); onClose(); }
    };

    (async () => {
      try {
        if (deviceId) {
          controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current!, onResult);
        } else {
          try {
            controls = await reader.decodeFromConstraints(
              { video: { facingMode: { ideal: "environment" } } }, videoRef.current!, onResult);
          } catch {
            controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, onResult);
          }
        }
        if (cancelled) { controls?.stop(); return; }
        const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        setCameras(devs);
      } catch {
        setError("Cannot access the camera. Allow camera permission, close other apps using it, and make sure you're on HTTPS or localhost.");
      }
    })();

    return () => { cancelled = true; try { controls?.stop(); } catch { /* */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return (
    <div className="fixed inset-0 bg-black/85 z-[60] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-2 border-b border-line gap-2">
          <span className="text-sm font-medium">Scanning… <span className="text-muted font-normal">{count} scanned</span></span>
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <select className="rounded border border-line bg-paper px-1.5 py-1 text-xs max-w-[130px]"
                value={deviceId ?? ""} onChange={(e) => setDeviceId(e.target.value || undefined)}>
                {cameras.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>)}
              </select>
            )}
            <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
          </div>
        </div>
        <div className="relative bg-black aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-3/4 h-1/3 border-2 border-emerald-400 rounded-md shadow-[0_0_0_2000px_rgba(0,0,0,0.25)]" />
          </div>
          {/* live feedback badge */}
          {note && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm font-medium px-3 py-1.5 rounded-full flex items-center gap-1 shadow">
              <Check size={15} /> {note.replace(/^✓\s*/, "")}
            </div>
          )}
        </div>
        <div className="px-4 pt-2 text-xs">
          {error ? <p className="text-danger">{error}</p> : <p className="text-muted text-center">Point at a barcode — keep scanning item after item.</p>}
        </div>
        <div className="p-3">
          <button onClick={onClose}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-base font-bold">
            Done{count > 0 ? ` · ${count} scanned` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
