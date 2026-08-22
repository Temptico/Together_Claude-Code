import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Share2, ChevronLeft, Camera, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCodeDisplay } from "@/components/QrCodeDisplay";
import { QrScanner } from "@/components/QrScanner";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function extractConnectCode(scannedText: string): string | null {
  const urlMatch = scannedText.match(/\/invite\/([A-Za-z0-9]{8})/);
  if (urlMatch) return urlMatch[1].toUpperCase();
  const trimmed = scannedText.trim().toUpperCase();
  if (/^[A-Z0-9]{8}$/.test(trimmed)) return trimmed;
  return null;
}

export default function ConnectPartner() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = `${window.location.origin}/invite/${user!.connectCode}`;

  useEffect(() => {
    const pending = sessionStorage.getItem("together:pendingInviteCode");
    if (pending) {
      setCode(pending);
      sessionStorage.removeItem("together:pendingInviteCode");
    }
  }, []);

  const copyCode = async () => {
    await navigator.clipboard.writeText(user!.connectCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Together", text: t("partner.inviteDesc"), url: inviteUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(inviteUrl);
      toast({ title: t("partner.copied") });
    }
  };

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (codeToUse: string) =>
      apiRequest("POST", "/api/partner/connect", { userId: user!.id, code: codeToUse.toUpperCase() }),
    onSuccess: (partner: any) => {
      setUser({ ...user!, partnerId: partner.id });
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      navigate("/");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t("common.error"));
      setScanning(false);
    },
  });

  const handleScan = (text: string) => {
    const extracted = extractConnectCode(text);
    setScanning(false);
    if (!extracted) {
      setScanError(t("partner.invalidQr"));
      return;
    }
    setCode(extracted);
    setError(null);
    mutation.mutate(extracted);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <button onClick={() => navigate("/")} className="flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <div className="text-center">
        <div className="text-4xl">💌</div>
        <h1 className="mt-1 text-xl font-extrabold">{t("partner.connectTitle")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("partner.yourCode")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div className="w-full rounded-2xl bg-muted p-4 text-center text-2xl font-extrabold tracking-[0.3em] text-primary">
            {user!.connectCode}
          </div>
          <QrCodeDisplay value={inviteUrl} />
          <div className="flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={copyCode}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("partner.copied") : t("partner.copyCode")}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={shareInvite}>
              <Share2 className="h-4 w-4" />
              {t("partner.shareInvite")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("partner.enterCode")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {scanning ? (
            <div className="flex flex-col gap-3">
              <p className="text-center text-xs text-muted-foreground">{t("partner.scanHint")}</p>
              <QrScanner
                active={scanning}
                onScan={handleScan}
                onError={() => {
                  setScanError(t("partner.cameraError"));
                  setScanning(false);
                }}
              />
              <Button variant="ghost" onClick={() => setScanning(false)}>
                <X className="h-4 w-4" /> {t("profile.cancel")}
              </Button>
            </div>
          ) : (
            <>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="A7K2P9XZ"
                className="text-center text-lg font-bold tracking-[0.2em]"
              />
              {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
              <Button disabled={code.length !== 8 || mutation.isPending} onClick={() => mutation.mutate(code)}>
                {t("partner.connect")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setScanError(null);
                  setScanning(true);
                }}
              >
                <Camera className="h-4 w-4" /> {t("partner.scanQr")}
              </Button>
              {scanError && <p className="text-sm font-semibold text-destructive">{scanError}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
