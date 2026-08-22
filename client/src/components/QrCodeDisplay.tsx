import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeDisplay({ value, size = 220 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#3d1f2a", light: "#00000000" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div
      className="flex items-center justify-center rounded-2xl bg-white p-3"
      style={{ width: size + 24, height: size + 24 }}
    >
      {dataUrl ? (
        <img src={dataUrl} alt="QR koda za povezavo" width={size} height={size} />
      ) : (
        <div className="h-full w-full animate-pulse rounded-xl bg-muted" />
      )}
    </div>
  );
}
