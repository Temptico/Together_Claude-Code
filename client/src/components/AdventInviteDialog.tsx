import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { localToday } from "@/lib/locale";
import { adventQueryKey, useAdvent, type AdventState } from "@/hooks/use-advent";

const LAST_SHOWN_KEY = "together:adventInviteShown";

// Shown once a day from 25 Nov to 24 Dec to couples who haven't joined the
// advent calendar yet. Waits a moment after the app opens so it doesn't
// stack on top of another dialog (install reminder, notifications,
// connection celebration) — if one is open, it tries again next launch.
export function AdventInviteDialog() {
  const { data } = useAdvent();
  const [open, setOpen] = useState(false);
  const eligible = !!data && !data.joined && (data.phase === "invite" || data.phase === "active");

  useEffect(() => {
    if (!eligible) return;
    let lastShown: string | null = null;
    try {
      lastShown = localStorage.getItem(LAST_SHOWN_KEY);
    } catch {
      // No storage: still show it, just not remembered.
    }
    if (lastShown === localToday()) return;
    const timer = setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return;
      setOpen(true);
      try {
        localStorage.setItem(LAST_SHOWN_KEY, localToday());
      } catch {
        // ignore
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [eligible]);

  if (!eligible) return null;
  return <AdventJoinDialog open={open} onOpenChange={setOpen} />;
}

// The invite itself: description, the reward, an optional consent box and
// "Join". Also opened from the home-screen banner.
export function AdventJoinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang } = useTranslation();
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const { data } = useAdvent();
  const [consent, setConsent] = useState(false);

  const join = useMutation({
    mutationFn: () =>
      apiRequest<AdventState>("POST", "/api/advent/join", { userId: user!.id, marketingConsent: consent || undefined }),
    onSuccess: (state) => {
      qc.setQueryData(adventQueryKey(user!.id, lang), state);
      if (consent && user) setUser({ ...user, marketingConsent: true });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="text-4xl">🎄</div>
          <DialogTitle>{t("advent.title")}</DialogTitle>
          <DialogDescription>{t("advent.inviteBody")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm font-semibold text-primary">{t("advent.inviteReward")}</p>
        {data?.needsConsent && <ConsentCheckbox checked={consent} onChange={setConsent} className="mt-3" />}
        <div className="mt-4 flex flex-col gap-2">
          <Button disabled={join.isPending} onClick={() => join.mutate()}>
            {t("advent.join")}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("advent.later")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Never pre-ticked: under GDPR only an active tick counts as consent.
export function ConsentCheckbox({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <label className={`flex items-start gap-2 text-xs text-muted-foreground ${className ?? ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
      />
      <span>{t("auth.marketingConsent")}</span>
    </label>
  );
}
