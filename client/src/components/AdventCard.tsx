import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Gift, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { adventQueryKey, fill, useAdvent, type AdventDay, type AdventState } from "@/hooks/use-advent";
import { AdventJoinDialog } from "@/components/AdventInviteDialog";

// Home-screen advent calendar: progress toward the gift, a 24-window grid
// (today and earlier open, later ones locked) and the reward once earned.
// Couples who haven't joined see a small banner that opens the invite.
export function AdventCard() {
  const { t } = useTranslation();
  const { data } = useAdvent();
  const [openDay, setOpenDay] = useState<AdventDay | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!data || data.phase === "off") return null;
  if (!data.joined) {
    if (data.phase === "catchup") return null;
    return (
      <>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-3 rounded-3xl bg-together-warm p-4 text-left text-white shadow-md"
        >
          <span className="text-3xl">🎄</span>
          <span className="flex-1">
            <span className="block font-extrabold">{t("advent.title")}</span>
            <span className="block text-sm">{t("advent.inviteBody")}</span>
          </span>
        </button>
        <AdventJoinDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      </>
    );
  }

  const total = data.days.length;
  const reached = data.completedCount >= data.goal;
  const progressPct = Math.min(100, Math.round((data.completedCount / total) * 100));
  const goalPct = Math.round((data.goal / total) * 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-end justify-between gap-2">
          <p className="text-lg font-extrabold">🎄 {t("advent.title")}</p>
          <span className="text-sm font-extrabold text-primary">
            {fill(t("advent.progress"), { n: data.completedCount, total })}
          </span>
        </div>
        {/* Whole season (n/24), with a marker where the gift unlocks. */}
        <div className="relative pt-1" aria-hidden>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="absolute top-0 w-0.5 -translate-x-1/2 rounded bg-foreground/40" style={{ left: `${goalPct}%`, height: "18px" }} />
        </div>
        <span className="text-xs font-bold text-muted-foreground">
          {reached ? t("advent.progressDone") : fill(t("advent.toGift"), { k: data.goal - data.completedCount })}
        </span>

        {data.phase === "invite" && <p className="text-sm text-muted-foreground">{t("advent.opensDec1")}</p>}

        <div className="grid grid-cols-6 gap-1.5">
          {data.days.map((d) => (
            <button
              key={d.day}
              onClick={() => setOpenDay(d)}
              aria-label={fill(t("advent.day"), { day: d.day })}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-xl text-sm font-extrabold",
                d.completed
                  ? "bg-primary text-primary-foreground"
                  : d.open
                    ? d.day === data.today
                      ? "bg-together-warm text-white ring-2 ring-primary ring-offset-2 ring-offset-card"
                      : "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {d.completed ? <Check className="h-4 w-4" /> : !d.open ? <Lock className="h-3.5 w-3.5 opacity-60" /> : d.day}
              {d.type === "temptico" && d.open && !d.completed && <span className="absolute -right-0.5 -top-0.5 text-[10px]">🎁</span>}
            </button>
          ))}
        </div>

        {data.reward ? <RewardBox code={data.reward.code} /> : reached ? <p className="text-sm text-muted-foreground">{t("advent.rewardPending")}</p> : null}
      </CardContent>
      <DayDialog day={openDay} state={data} onClose={() => setOpenDay(null)} />
    </Card>
  );
}

function DayDialog({ day, state, onClose }: { day: AdventDay | null; state: AdventState; onClose: () => void }) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const complete = useMutation({
    mutationFn: (n: number) => apiRequest<AdventState>("POST", "/api/advent/complete", { userId: user!.id, day: n }),
    onSuccess: (next) => {
      qc.setQueryData(adventQueryKey(user!.id, lang), next);
      onClose();
    },
  });

  // Look up the current version (e.g. completed flag after a refetch).
  const current = day ? state.days.find((d) => d.day === day.day) ?? day : null;
  const typeLabel =
    current?.type === "temptico" ? t("advent.typeTemptico") : current?.type === "question" ? t("advent.typeQuestion") : t("advent.typeTask");

  const trackOffer = () => {
    if (!user) return;
    apiRequest("POST", "/api/track/temptico-click", { userId: user.id, source: "advent" }).catch(() => {});
  };

  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {current && (
          <>
            <DialogHeader>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {fill(t("advent.day"), { day: current.day })} · {typeLabel}
              </p>
              <DialogTitle>{current.open ? current.title : t("advent.lockedTitle")}</DialogTitle>
              <DialogDescription className="text-base text-foreground">
                {current.open
                  ? current.text
                  : state.phase === "invite"
                    ? t("advent.opensDec1")
                    : current.day === state.today + 1
                      ? t("advent.lockedTomorrow")
                      : fill(t("advent.locked"), { day: current.day })}
              </DialogDescription>
            </DialogHeader>
            {current.open && (
              <div className="mt-4 flex flex-col gap-2">
                <Button disabled={current.completed || complete.isPending} onClick={() => complete.mutate(current.day)}>
                  {current.completed ? t("advent.doneAlready") : t("advent.done")}
                </Button>
                {current.offerUrl && (
                  <a
                    href={current.offerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={trackOffer}
                    className="mx-auto flex items-center gap-1 py-1.5 text-xs font-semibold text-muted-foreground underline underline-offset-4"
                  >
                    <Gift className="h-3.5 w-3.5" /> {t("advent.viewOffer")}
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RewardBox({ code }: { code: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: t("advent.copied") });
    } catch {
      // Clipboard blocked: the code is on screen to copy by hand.
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-accent p-3">
      <p className="font-extrabold">{t("advent.rewardTitle")}</p>
      <p className="text-sm">{t("advent.rewardBody")}</p>
      <div className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2">
        <span className="min-w-0 select-all break-all font-mono text-base font-extrabold tracking-wide">{code}</span>
        <Button size="icon" variant="ghost" onClick={copy} aria-label={t("advent.copy")}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("advent.rewardNote")}</p>
    </div>
  );
}
