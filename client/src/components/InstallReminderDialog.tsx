import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useTranslation } from "@/i18n/i18n";

const LAST_SHOWN_KEY = "together:installReminderLastShown";
const REPEAT_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48h

// One-day broadcast override, requested explicitly: show the popup to every
// user today regardless of install status or the 48h cooldown, to maximize
// visibility right after shipping this feature. Remove this block (and the
// forceToday checks below) once today has passed — it's a deliberate,
// temporary exception to the normal targeting, not a permanent behavior.
const FORCE_SHOW_ALL_DATE = "2026-08-29";
function isForceShowDay(): boolean {
  return new Date().toISOString().slice(0, 10) === FORCE_SHOW_ALL_DATE;
}

// Gently nudges users who haven't installed the PWA yet toward doing so —
// mounted once at the authenticated app shell level so it can surface on
// any page, at most once per 48h, and is always dismissible (the Dialog's
// built-in X, backdrop click, or the "maybe later" button all close it
// without installing — none of that resets the 48h timer early).
export function InstallReminderDialog() {
  const { t } = useTranslation();
  const { showInstallCard, canInstall, install, instructionsKey } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const forceToday = isForceShowDay();

  useEffect(() => {
    if (!showInstallCard && !forceToday) return;
    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_SHOWN_KEY) || "0");
    } catch {
      /* localStorage unavailable (private mode etc.) — just skip nagging this session */
      return;
    }
    // The forced broadcast still only shows once per browser (not once per
    // page nav) — it ignores the 48h cooldown, not "has this device already
    // seen today's broadcast".
    const alreadyShownToday = forceToday && new Date(last).toISOString().slice(0, 10) === FORCE_SHOW_ALL_DATE;
    if (!forceToday && Date.now() - last < REPEAT_INTERVAL_MS) return;
    if (alreadyShownToday) return;
    setOpen(true);
    try {
      localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, [showInstallCard, forceToday]);

  if (!showInstallCard && !forceToday) return null;

  const handleInstall = async () => {
    await install();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>📲 {t("profile.installApp")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("installReminder.body")}</p>
          <p className="text-sm text-muted-foreground">{canInstall ? t("profile.installDesc") : t(instructionsKey)}</p>
        </div>
        <div className="mt-4 flex gap-2">
          {canInstall && (
            <Button className="flex-1" onClick={handleInstall}>
              {t("profile.install")}
            </Button>
          )}
          <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            {t("installReminder.later")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
