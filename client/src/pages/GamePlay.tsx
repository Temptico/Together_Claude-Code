import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, PartyPopper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { GAMES, type GameSlug } from "@shared/schema";

type Prompt = {
  id: number;
  gameSlug: string;
  text: string;
  optionA?: string | null;
  optionB?: string | null;
  myAnswer: string | null;
  partnerAnswer: string | null;
};

function formatAnswer(format: string, prompt: Prompt, answer: string, iHave: string, never: string) {
  if (format === "boolean") return answer === "yes" ? iHave : never;
  if (format === "choice") return answer === "A" ? prompt.optionA : prompt.optionB;
  return answer;
}

export default function GamePlay() {
  const [, params] = useRoute("/games/:slug");
  const slug = params?.slug as GameSlug | undefined;
  const game = slug && slug in GAMES ? GAMES[slug] : undefined;

  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [roundId, setRoundId] = useState<number | null>(null);
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState("");

  const startMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ roundId: number; gameSlug: string; prompts: Prompt[] }>("POST", "/api/games/start", {
        userId: user!.id,
        gameSlug: slug,
      }),
    onSuccess: (data) => {
      setRoundId(data.roundId);
      setPrompts(data.prompts);
      const firstUnanswered = data.prompts.findIndex((p) => !p.myAnswer);
      setIndex(firstUnanswered === -1 ? data.prompts.length : firstUnanswered);
    },
  });

  useEffect(() => {
    if (slug && user) startMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const current = prompts && index !== null && index < prompts.length ? prompts[index] : null;

  useEffect(() => {
    setTextDraft("");
  }, [current?.id]);

  const answerMutation = useMutation({
    mutationFn: (answer: string) =>
      apiRequest("POST", "/api/games/answer", { userId: user!.id, roundId, promptId: current!.id, answer }),
    onSuccess: (_data, answer) => {
      const answeredId = current!.id;
      setPrompts((prev) => prev!.map((p) => (p.id === answeredId ? { ...p, myAnswer: answer } : p)));
      qc.invalidateQueries({ queryKey: ["/api/games/summary", user!.id] });
      setIndex((i) => (i === null ? null : i + 1));
    },
  });

  if (!game) {
    navigate("/");
    return null;
  }

  if (!prompts || index === null) {
    return <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const total = prompts.length;
  const roundComplete = prompts.every((p) => p.myAnswer && p.partnerAnswer);

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <button onClick={() => navigate("/")} className="flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <div className="flex items-center gap-2">
        <span className="text-2xl">{game.emoji}</span>
        <div>
          <p className="text-sm font-extrabold">{game.name}</p>
          {current && (
            <p className="text-xs text-muted-foreground">
              {index + 1}/{total}
            </p>
          )}
        </div>
      </div>

      {current && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(index / total) * 100}%` }} />
        </div>
      )}

      {current ? (
        <>
          <Card className={cn("border-none bg-gradient-to-br text-white shadow-md", game.gradient)}>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-lg font-extrabold">{current.text}</p>
            </CardContent>
          </Card>

          {game.format === "boolean" && (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                size="lg"
                disabled={answerMutation.isPending}
                onClick={() => answerMutation.mutate("yes")}
              >
                {t("games.iHave")}
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                size="lg"
                disabled={answerMutation.isPending}
                onClick={() => answerMutation.mutate("no")}
              >
                {t("games.never")}
              </Button>
            </div>
          )}

          {game.format === "choice" && (
            <div className="flex flex-col gap-3">
              <Button
                className="h-auto whitespace-normal py-4 text-left"
                variant="outline"
                disabled={answerMutation.isPending}
                onClick={() => answerMutation.mutate("A")}
              >
                {current.optionA}
              </Button>
              <Button
                className="h-auto whitespace-normal py-4 text-left"
                variant="outline"
                disabled={answerMutation.isPending}
                onClick={() => answerMutation.mutate("B")}
              >
                {current.optionB}
              </Button>
            </div>
          )}

          {game.format === "text" && (
            <div className="flex flex-col gap-3">
              <Textarea
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder={t("games.answerPlaceholder")}
                rows={4}
              />
              <Button
                disabled={!textDraft.trim() || answerMutation.isPending}
                onClick={() => answerMutation.mutate(textDraft.trim())}
              >
                {t("games.submit")}
              </Button>
            </div>
          )}

          <button
            onClick={() => setIndex((i) => (i === null ? null : i + 1))}
            className="self-center text-sm font-bold text-muted-foreground"
          >
            {t("games.skip")}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className={cn("border-none bg-gradient-to-br text-white shadow-md", game.gradient)}>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <PartyPopper className="h-8 w-8" />
              <p className="text-lg font-extrabold">{roundComplete ? t("games.roundComplete") : t("games.waitingForPartner")}</p>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {prompts
              .filter((p) => p.myAnswer)
              .map((p) => (
                <div key={p.id} className="rounded-2xl bg-muted p-3">
                  <p className="text-sm font-semibold">{p.text}</p>
                  <div className="mt-2 flex flex-col gap-1 text-xs">
                    <p>
                      <span className="font-bold">{t("games.myAnswer")}:</span>{" "}
                      {formatAnswer(game.format, p, p.myAnswer!, t("games.iHave"), t("games.never"))}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-bold">{t("games.partnerAnswer")}:</span>{" "}
                      {p.partnerAnswer
                        ? formatAnswer(game.format, p, p.partnerAnswer, t("games.iHave"), t("games.never"))
                        : t("games.notYet")}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          {roundComplete && (
            <Button
              disabled={startMutation.isPending}
              onClick={() => {
                setPrompts(null);
                setIndex(null);
                startMutation.mutate();
              }}
            >
              {t("games.playAgain")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
