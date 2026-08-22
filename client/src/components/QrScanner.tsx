import { useEffect, useId, useRef } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

export function QrScanner({
  active,
  onScan,
  onError,
}: {
  active: boolean;
  onScan: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const rawId = useId();
  const elementId = `qr-scanner-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const stoppedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    stoppedRef.current = false;
    startedRef.current = false;
    const scanner = new Html5Qrcode(elementId);

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          onScan(decodedText);
        },
        () => {
          /* per-frame decode miss, ignore */
        }
      )
      .then(() => {
        startedRef.current = true;
      })
      .catch((err) => {
        onError?.(typeof err === "string" ? err : "Dostop do kamere ni mogoč");
      });

    return () => {
      stoppedRef.current = true;
      const state = scanner.getState();
      if (startedRef.current && (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED)) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      } else {
        try {
          scanner.clear();
        } catch {
          /* nothing to clear */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, elementId]);

  if (!active) return null;

  return (
    <div className="overflow-hidden rounded-2xl">
      <div id={elementId} />
    </div>
  );
}
