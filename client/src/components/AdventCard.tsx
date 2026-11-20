import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { adventQueryKey, fill, useAdvent, type AdventDay, type AdventState } from "@/hooks/use-advent";
import { AdventJoinDialog } from "@/components/AdventInviteDialog";
import { celebrate, denied, unlockAudio } from "@/lib/celebrate";

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

        <AdventHouse state={data} onPick={setOpenDay} />

        {data.days.some((d) => d.canHideMessage) && data.today < 24 && (
          <p className="text-xs text-muted-foreground">{t("advent.hideTeaser")}</p>
        )}
        {data.today >= 24 && (data.phase === "active" || data.phase === "catchup") && (
          <Button asChild variant="outline">
            <Link href="/advent">{t("advent.finaleButton")}</Link>
          </Button>
        )}

        {data.reward ? <RewardBox code={data.reward.code} /> : reached ? <p className="text-sm text-muted-foreground">{t("advent.rewardPending")}</p> : null}
      </CardContent>
      <DayDialog day={openDay} state={data} onClose={() => setOpenDay(null)} />
    </Card>
  );
}

// The calendar as a snowy cabin: 24 doors. Done days stay ajar with a tick
// inside; tapping an open day swings its door before the day pops up; a
// locked door just shakes and Santa says no.
function AdventHouse({ state, onPick }: { state: AdventState; onPick: (d: AdventDay) => void }) {
  const { t } = useTranslation();
  const [swinging, setSwinging] = useState<number | null>(null);
  const [shaking, setShaking] = useState<number | null>(null);

  const pick = (d: AdventDay) => {
    if (swinging) return;
    if (!d.open) {
      unlockAudio();
      denied();
      setShaking(d.day);
      setTimeout(() => setShaking(null), 400);
      onPick(d);
      return;
    }
    if (d.completed) {
      onPick(d);
      return;
    }
    setSwinging(d.day);
    setTimeout(() => {
      setSwinging(null);
      onPick(d);
    }, 450);
  };

  return (
    <div className="advent-house mx-auto w-full max-w-sm px-3 pt-4">
      <div className="relative">
        <div className="advent-chimney" aria-hidden />
        <div className="advent-roof" aria-hidden />
      </div>
      <div className="advent-snow" aria-hidden />
      <div className="advent-lights" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => <span key={i} />)}
      </div>
      <div className="advent-wall">
        <div className="grid grid-cols-6 gap-x-2 gap-y-2.5">
          {state.days.map((d) => (
            <button
              key={d.day}
              onClick={() => pick(d)}
              aria-label={fill(t("advent.day"), { day: d.day })}
              className={cn(
                "advent-door",
                d.day === state.today && !d.completed && "is-today",
                !d.open && "is-locked",
                d.completed && "is-open",
                swinging === d.day && "is-swinging",
                shaking === d.day && "is-shaking"
              )}
            >
              <span className="advent-door-inside">
                {d.completed ? <Check className="h-4 w-4" /> : <span className="text-sm">⭐</span>}
              </span>
              <span className="advent-door-leaf">
                {d.day === state.today && !d.completed && <span className="advent-wreath" aria-hidden />}
                {d.day}
              </span>
              {d.hasMessage && !d.completed && (
                <span className="absolute -left-1.5 -top-1.5 z-10 text-[10px]" aria-hidden>
                  💌
                </span>
              )}
              {d.type === "temptico" && d.open && !d.completed && (
                <span className="absolute -right-1.5 -top-1.5 z-10 text-[10px]" aria-hidden>
                  🎁
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
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
      celebrate();
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
            {!current.open && current.hasMessage && <p className="text-sm font-semibold text-primary">{t("advent.sealed")}</p>}
            {current.open && current.message && (
              <div className="mt-1 flex flex-col gap-1 rounded-2xl bg-accent/60 p-3">
                <p className="text-xs font-bold text-primary">{t("advent.messageForYou")}</p>
                <p className="whitespace-pre-line text-base">{current.message}</p>
              </div>
            )}
            {current.open && (
              <div className="mt-4 flex flex-col gap-2">
                <Button disabled={current.completed || complete.isPending} onClick={() => {
                    unlockAudio();
                    complete.mutate(current.day);
                  }}
                >
                  {current.completed ? t("advent.doneAlready") : t("advent.done")}
                </Button>
                {current.gift && <GiftCodeBox code={current.gift.code} note={current.gift.note} />}
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
            {current.canHideMessage && <HideMessageBox key={current.day} day={current.day} existing={current.myMessage} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Write (or change, or remove) the note the partner finds behind this door.
function HideMessageBox({ day, existing }: { day: number; existing: string | null }) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState(existing ?? "");
  const [editing, setEditing] = useState(!existing);
  useEffect(() => setText(existing ?? ""), [existing]);

  const save = useMutation({
    mutationFn: (value: string) => apiRequest<AdventState>("POST", "/api/advent/message", { userId: user!.id, day, text: value }),
    onSuccess: (next, value) => {
      qc.setQueryData(adventQueryKey(user!.id, lang), next);
      toast({ title: value.trim() ? t("advent.hideSaved") : t("advent.hideRemoved") });
      setEditing(!value.trim());
    },
  });

  if (existing && !editing) {
    return (
      <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
        <p className="text-xs font-bold text-primary">{t("advent.myHidden")}</p>
        <p className="whitespace-pre-line text-sm">{existing}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("common.edit")}
          </Button>
          <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => save.mutate("")}>
            {t("advent.hideDelete")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-sm font-bold">{t("advent.hideTitle")}</p>
      <p className="text-xs text-muted-foreground">{t("advent.hideHint")}</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder={t("advent.hidePlaceholder")}
      />
      <Button variant="outline" disabled={!text.trim() || save.isPending} onClick={() => save.mutate(text)}>
        {existing ? t("advent.hideUpdate") : t("advent.hideSave")}
      </Button>
    </div>
  );
}

// A small extra from a Temptico day (e.g. a free gift with an order):
// a short note and the code, kept below the day itself.
function GiftCodeBox({ code, note }: { code: string; note: string | null }) {
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
    <div className="mt-1 flex flex-col gap-1.5 rounded-2xl bg-accent/60 p-3 text-sm">
      {note && <p>{note}</p>}
      <div className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-1.5">
        <span className="min-w-0 select-all break-all font-mono font-extrabold tracking-wide">{code}</span>
        <Button size="icon" variant="ghost" onClick={copy} aria-label={t("advent.copy")}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
