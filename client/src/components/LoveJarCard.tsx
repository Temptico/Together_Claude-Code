import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/i18n";
import { apiRequest, errorText } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { bcp47 } from "@/lib/locale";
import { heartPing, unlockAudio } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

type Note = { id: number; text: string; drawnAt: string | null };
type Jar = {
  waiting: number;
  today: { id: number; text: string; createdAt: string } | null;
  drawn: Note[];
  mine: Note[];
  mineWaiting: number;
};

const SLIP_COLORS = ["#fde3dc", "#ffe9a8", "#dff3e4", "#e3e8ff", "#fbd5e5"];
const NOTE_MAX = 200;

// The love jar: each partner drops little notes ("why I love you") into the
// other's jar, and the other draws one a day.
export function LoveJarCard({ userId, partnerName }: { userId: string; partnerName: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const queryKey = ["/api/jar", userId];
  const { data: jar } = useQuery<Jar | null>({ queryKey });
  const [writing, setWriting] = useState(false);
  const [history, setHistory] = useState(false);
  const [justDrawn, setJustDrawn] = useState(false);

  const draw = useMutation({
    mutationFn: () => apiRequest<Jar>("POST", "/api/jar/draw", { userId }),
    onSuccess: (next) => {
      qc.setQueryData(queryKey, next);
      setJustDrawn(true);
      heartPing();
      navigator.vibrate?.(30);
    },
  });

  if (!jar) return null;
  const slips = Math.min(jar.waiting, 14);

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-extrabold">🫙 {t("jar.title")}</p>
            <p className="text-sm text-muted-foreground">
              {jar.waiting > 0 ? t("jar.waiting").replace("{n}", String(jar.waiting)) : t("jar.empty").replace("{name}", partnerName)}
            </p>
          </div>
          {jar.drawn.length > 0 && (
            <button className="shrink-0 text-xs font-bold text-primary" onClick={() => setHistory(true)}>
              {t("jar.history")} ({jar.drawn.length})
            </button>
          )}
        </div>

        {jar.today ? (
          <div className={cn("love-note mx-auto w-full max-w-xs rounded-2xl p-4 shadow-md", justDrawn && "love-note-pop")}>
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#a8352b]">
              {t("jar.fromName").replace("{name}", partnerName)}
            </p>
            <p className="mt-1 whitespace-pre-line font-display text-lg font-bold leading-snug text-[#2b1d1a]">{jar.today.text}</p>
            <p className="mt-2 text-xs text-[#7a5a50]">{t("jar.tomorrow")}</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="love-jar relative h-28 w-24 shrink-0" aria-hidden>
              <div className="love-jar-lid" />
              <div className="love-jar-glass">
                {Array.from({ length: slips }, (_, i) => (
                  <span
                    key={i}
                    className="love-jar-slip"
                    style={{
                      background: SLIP_COLORS[i % SLIP_COLORS.length],
                      left: `${8 + ((i * 37) % 60)}%`,
                      bottom: `${4 + Math.floor(i / 3) * 12}%`,
                      transform: `rotate(${((i * 53) % 70) - 35}deg)`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {jar.waiting > 0 ? (
                <Button
                  disabled={draw.isPending}
                  onClick={() => {
                    unlockAudio();
                    draw.mutate();
                  }}
                >
                  {t("jar.draw")}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">{t("jar.emptyHint")}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {jar.mineWaiting > 0
              ? t("jar.mineWaiting").replace("{name}", partnerName).replace("{n}", String(jar.mineWaiting))
              : t("jar.writeHint").replace("{name}", partnerName)}
          </p>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setWriting(true)}>
            ✍️ {t("jar.write")}
          </Button>
        </div>
      </CardContent>

      <WriteDialog open={writing} onClose={() => setWriting(false)} userId={userId} partnerName={partnerName} jar={jar} />
      <HistoryDialog open={history} onClose={() => setHistory(false)} jar={jar} partnerName={partnerName} />
    </Card>
  );
}

function WriteDialog({
  open,
  onClose,
  userId,
  partnerName,
  jar,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  partnerName: string;
  jar: Jar;
}) {
  const { t, lang } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = ["/api/jar", userId];
  const [text, setText] = useState("");
  const starters = t("jar.starters").split("|");

  const add = useMutation({
    mutationFn: () => apiRequest<Jar>("POST", "/api/jar", { userId, text }),
    onSuccess: (next) => {
      qc.setQueryData(queryKey, next);
      setText("");
      toast({ title: t("jar.added") });
    },
    onError: (err) => toast({ title: errorText(err), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest<Jar>("DELETE", `/api/jar/${id}?userId=${userId}`),
    onSuccess: (next) => qc.setQueryData(queryKey, next),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✍️ {t("jar.writeTitle")}</DialogTitle>
          <DialogDescription>{t("jar.writeDesc").replace("{name}", partnerName)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {starters.map((s) => (
            <button
              key={s}
              onClick={() => setText(s + " ")}
              className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-bold text-primary"
            >
              {s} …
            </button>
          ))}
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          placeholder={t("jar.placeholder")}
        />
        <Button disabled={text.trim().length < 2 || add.isPending} onClick={() => add.mutate()}>
          {t("jar.add")}
        </Button>

        {jar.mine.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs font-bold text-muted-foreground">{t("jar.myNotes")}</p>
            {jar.mine.map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-2xl bg-muted p-3">
                <p className="flex-1 whitespace-pre-line text-sm">{n.text}</p>
                {n.drawnAt ? (
                  <span className="shrink-0 text-[11px] font-bold text-primary">
                    ✓ {t("jar.read")} {new Date(n.drawnAt).toLocaleDateString(bcp47(lang), { day: "numeric", month: "short" })}
                  </span>
                ) : (
                  <button
                    onClick={() => remove.mutate(n.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ open, onClose, jar, partnerName }: { open: boolean; onClose: () => void; jar: Jar; partnerName: string }) {
  const { t, lang } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>💌 {t("jar.historyTitle")}</DialogTitle>
          <DialogDescription>{t("jar.fromName").replace("{name}", partnerName)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {jar.drawn.map((n) => (
            <div key={n.id} className="love-note rounded-2xl p-3">
              <p className="whitespace-pre-line text-sm font-semibold text-[#2b1d1a]">{n.text}</p>
              {n.drawnAt && (
                <p className="mt-1 text-[11px] text-[#7a5a50]">
                  {new Date(n.drawnAt).toLocaleDateString(bcp47(lang), { day: "numeric", month: "long" })}
                </p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
