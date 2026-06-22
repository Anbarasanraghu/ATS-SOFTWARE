import { Suspense, lazy } from "react";

// The ZXing camera library is large, so only load it when a scanner is opened.
const Inner = lazy(() => import("./CameraScanner"));

export default function LazyCameraScanner(props: {
  onDetect: (code: string) => void;
  onClose: () => void;
  continuous?: boolean;
  note?: string;
}) {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center text-white text-sm">
        Loading camera…
      </div>
    }>
      <Inner {...props} />
    </Suspense>
  );
}
