import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShareStoryButton } from "@/components/ShareStoryButton";
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
  // The "hide a note" window: from the button (pick any day) or offered
  // right after a day is done (tomorrow's door).
  const [note, setNote] = useState<{ prompt: boolean } | null>(null);

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

        {data.days.some((d) => d.canHideMessage) && (
          <Button variant="outline" onClick={() => setNote({ prompt: false })}>
            {t("advent.noteButton")}
          </Button>
        )}
        {data.today >= 24 && (data.phase === "active" || data.phase === "catchup") && (
          <Button asChild variant="outline">
            <Link href="/advent">{t("advent.finaleButton")}</Link>
          </Button>
        )}

        {data.reward ? <RewardBox code={data.reward.code} /> : reached ? <p className="text-sm text-muted-foreground">{t("advent.rewardPending")}</p> : null}
      </CardContent>
      <DayDialog
        day={openDay}
        state={data}
        onClose={() => setOpenDay(null)}
        onCompleted={(next) => {
          // Offer a note for tomorrow once the confetti has had its moment.
          const tomorrow = next.days.find((d) => d.day === next.today + 1);
          if (tomorrow?.canHideMessage && !tomorrow.myMessage) setTimeout(() => setNote({ prompt: true }), 3000);
        }}
      />
      <NoteDialog
        open={!!note}
        prompt={!!note?.prompt}
        state={data}
        onClose={() => setNote(null)}
      />
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

function DayDialog({
  day,
  state,
  onClose,
  onCompleted,
}: {
  day: AdventDay | null;
  state: AdventState;
  onClose: () => void;
  onCompleted: (next: AdventState) => void;
}) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const complete = useMutation({
    mutationFn: (n: number) => apiRequest<AdventState>("POST", "/api/advent/complete", { userId: user!.id, day: n }),
    onSuccess: (next) => {
      qc.setQueryData(adventQueryKey(user!.id, lang), next);
      onClose();
      celebrate();
      onCompleted(next);
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
                {current.completed && (
                  <ShareStoryButton
                    card={{
                      emoji: "🎄",
                      kicker: fill(t("share.adventKicker"), { day: current.day }),
                      title: current.title ?? "",
                      subtitle: fill(t("advent.progress"), { n: state.completedCount, total: state.days.length }),
                    }}
                  />
                )}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Hide a note behind a door for the partner. Defaults to tomorrow's door;
// any door the partner hasn't opened yet can be picked instead. Your notes
// are listed below, tap one to change or remove it.
function NoteDialog({
  open,
  prompt,
  state,
  onClose,
}: {
  open: boolean;
  prompt: boolean;
  state: AdventState;
  onClose: () => void;
}) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const home = qc.getQueryData<{ partner: { name: string } | null }>(["/api/home", user?.id]);
  const partnerName = home?.partner?.name ?? "";

  const choices = state.days.filter((d) => d.canHideMessage);
  const fallback = choices.find((d) => d.day === state.today + 1) ?? choices.find((d) => d.day > state.today) ?? choices[0];
  const [day, setDay] = useState<number | null>(null);
  const [text, setText] = useState("");
  const selected = choices.find((d) => d.day === day) ?? fallback;

  // Each time the window opens, start on the default door with its note.
  useEffect(() => {
    if (!open) return;
    setDay(fallback?.day ?? null);
    setText(fallback?.myMessage ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickDay = (d: AdventDay) => {
    setDay(d.day);
    setText(d.myMessage ?? "");
  };

  const save = useMutation({
    mutationFn: (value: string) =>
      apiRequest<AdventState>("POST", "/api/advent/message", { userId: user!.id, day: selected!.day, text: value }),
    onSuccess: (next, value) => {
      qc.setQueryData(adventQueryKey(user!.id, lang), next);
      toast({ title: value.trim() ? t("advent.hideSaved") : t("advent.hideRemoved") });
      onClose();
    },
  });

  const dayLabel = (n: number) => (n === state.today + 1 ? t("advent.noteTomorrow") : n === state.today ? t("advent.noteToday") : String(n));
  const mine = state.days.filter((d) => d.myMessage);

  return (
    <Dialog open={open && !!selected} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        {selected && (
          <>
            <DialogHeader>
              <DialogTitle>{prompt ? t("advent.notePromptTitle") : t("advent.noteTitle")}</DialogTitle>
              <DialogDescription>
                {partnerName ? fill(t("advent.noteHint"), { name: partnerName }) : t("advent.hideHint")}
              </DialogDescription>
            </DialogHeader>

            {!prompt && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-muted-foreground">{t("advent.notePickDay")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {choices.map((d) => (
                    <button
                      key={d.day}
                      onClick={() => pickDay(d)}
                      className={cn(
                        "relative min-w-[2.5rem] rounded-full border px-3 py-1.5 text-sm font-bold",
                        d.day === selected.day ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                      )}
                    >
                      {dayLabel(d.day)}
                      {d.myMessage && <span className="absolute -right-1 -top-1.5 text-[10px]">💌</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              rows={4}
              autoFocus={!prompt}
              placeholder={t("advent.hidePlaceholder")}
            />
            <div className="flex gap-2">
              <Button className="flex-1" disabled={!text.trim() || save.isPending} onClick={() => save.mutate(text)}>
                {selected.myMessage ? t("advent.hideUpdate") : t("advent.hideSave")}
              </Button>
              {selected.myMessage ? (
                <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate("")}>
                  {t("advent.hideDelete")}
                </Button>
              ) : prompt ? (
                <Button variant="ghost" onClick={onClose}>
                  {t("advent.noteSkip")}
                </Button>
              ) : null}
            </div>

            {!prompt && mine.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-xs font-bold text-muted-foreground">{t("advent.myHiddenList")}</p>
                {mine.map((d) => (
                  <button
                    key={d.day}
                    onClick={() => pickDay(d)}
                    className="flex items-start gap-2 rounded-2xl bg-muted p-3 text-left"
                  >
                    <span className="text-xs font-extrabold text-primary">{fill(t("advent.day"), { day: d.day })}</span>
                    <span className="line-clamp-2 flex-1 text-sm">{d.myMessage}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
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
