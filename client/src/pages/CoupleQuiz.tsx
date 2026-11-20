import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShareStoryButton } from "@/components/ShareStoryButton";
import { LoadError } from "@/components/LoadError";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { cheer, unlockAudio } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import {
  COUPLE_TYPE_INFO,
  QUIZ_QUESTIONS,
  QUIZ_LENGTH,
  coupleResult,
  personalType,
  type CoupleType,
  type QuizLang,
} from "@shared/coupleQuiz";

type QuizState = {
  mine: number[] | null;
  partner: { name: string; done: boolean; answers: number[] | null } | null;
};

export default function CoupleQuiz() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["/api/quiz", user!.id];
  const { data, isLoading, isError, error, refetch } = useQuery<QuizState>({ queryKey });
  const [retaking, setRetaking] = useState(false);

  const submit = useMutation({
    mutationFn: (answers: number[]) => apiRequest<QuizState>("POST", "/api/quiz", { userId: user!.id, answers }),
    onSuccess: (next) => {
      qc.setQueryData(queryKey, next);
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      setRetaking(false);
      cheer();
      document.querySelector(".content-scroll-pad")?.scrollTo(0, 0);
    },
  });

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> {t("quiz.back")}
          </Link>
        </Button>
      </div>

      {!data && isError && !isLoading ? (
        <LoadError error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <div className="py-24 text-center text-3xl animate-pulse">💑</div>
      ) : !data.mine || retaking ? (
        <Questions
          initial={retaking ? data.mine : null}
          pending={submit.isPending}
          onDone={(answers) => {
            unlockAudio();
            submit.mutate(answers);
          }}
        />
      ) : data.partner?.answers ? (
        <CoupleResultView mine={data.mine} theirs={data.partner.answers} partnerName={data.partner.name} onRetake={() => setRetaking(true)} />
      ) : (
        <PersonalResult answers={data.mine} partner={data.partner} onRetake={() => setRetaking(true)} />
      )}
    </div>
  );
}

function Questions({ initial, pending, onDone }: { initial: number[] | null; pending: boolean; onDone: (a: number[]) => void }) {
  const { t, lang } = useTranslation();
  const l = lang as QuizLang;
  const [answers, setAnswers] = useState<number[]>(initial ?? []);
  const [index, setIndex] = useState(0);
  const q = QUIZ_QUESTIONS[index];

  const choose = (option: number) => {
    const next = [...answers];
    next[index] = option;
    setAnswers(next);
    if (index < QUIZ_LENGTH - 1) setTimeout(() => setIndex(index + 1), 180);
    else onDone(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
          <span>{t("quiz.title")}</span>
          <span>
            {index + 1}/{QUIZ_LENGTH}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + 1) / QUIZ_LENGTH) * 100}%` }} />
        </div>
      </div>
      <h1 key={index} className="text-2xl font-extrabold leading-tight">
        {q.text[l]}
      </h1>
      <div className="flex flex-col gap-3">
        {q.options.map((o, i) => (
          <button
            key={`${index}-${i}`}
            disabled={pending}
            onClick={() => choose(i)}
            className={cn(
              "rounded-2xl border-2 bg-card px-4 py-4 text-left text-base font-bold shadow-sm transition-all active:scale-[0.98]",
              answers[index] === i ? "border-primary bg-primary/10" : "border-border"
            )}
          >
            {o.text[l]}
          </button>
        ))}
      </div>
      {index > 0 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setIndex(index - 1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("quiz.previous")}
        </Button>
      )}
      {pending && <p className="text-center text-sm text-muted-foreground">{t("common.loading")}</p>}
    </div>
  );
}

function TypeHero({ type, kicker, match }: { type: CoupleType; kicker: string; match?: number }) {
  const { t, lang } = useTranslation();
  const info = COUPLE_TYPE_INFO[type];
  const l = lang as QuizLang;
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-together-warm p-6 text-center text-white shadow-md">
      <span className="text-6xl">{info.emoji}</span>
      <p className="text-xs font-extrabold uppercase tracking-wider text-white/85">{kicker}</p>
      <h1 className="text-3xl font-extrabold leading-tight">{info.name[l]}</h1>
      {match !== undefined && (
        <>
          <p className="mt-1 text-5xl font-extrabold">{match} %</p>
          <p className="text-sm font-bold text-white/90">{t(matchLabelKey(match))}</p>
        </>
      )}
      <p className="mt-2 text-sm text-white/95">{info.description[l]}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {info.strengths[l].map((s) => (
          <span key={s} className="rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function matchLabelKey(match: number) {
  return match >= 85 ? "quiz.match1" : match >= 70 ? "quiz.match2" : match >= 55 ? "quiz.match3" : "quiz.match4";
}

function TipAndDates({ type }: { type: CoupleType }) {
  const { t, lang } = useTranslation();
  const info = COUPLE_TYPE_INFO[type];
  const l = lang as QuizLang;
  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <p className="text-sm font-extrabold">💡 {t("quiz.tip")}</p>
          <p className="text-sm">{info.tip[l]}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <p className="text-sm font-extrabold">💘 {t("quiz.dates")}</p>
          <ul className="flex flex-col gap-1.5">
            {info.dates[l].map((d) => (
              <li key={d} className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold">
                {d}
              </li>
            ))}
          </ul>
          <Link href="/dates" className="text-sm font-bold text-primary">
            {t("quiz.moreDates")} →
          </Link>
        </CardContent>
      </Card>
    </>
  );
}

function CoupleResultView({
  mine,
  theirs,
  partnerName,
  onRetake,
}: {
  mine: number[];
  theirs: number[];
  partnerName: string;
  onRetake: () => void;
}) {
  const { t, lang } = useTranslation();
  const l = lang as QuizLang;
  const result = coupleResult(mine, theirs);
  const info = COUPLE_TYPE_INFO[result.type];
  const sameCount = result.same.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      <TypeHero type={result.type} kicker={t("quiz.youAre")} match={result.match} />
      <ShareStoryButton
        variant="default"
        size="default"
        card={{
          emoji: info.emoji,
          kicker: t("quiz.shareKicker"),
          title: info.name[l],
          big: `${result.match} %`,
          subtitle: info.description[l],
          chips: info.strengths[l],
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
            <span className="text-3xl">{COUPLE_TYPE_INFO[result.mine].emoji}</span>
            <p className="text-xs font-bold text-muted-foreground">{t("quiz.you")}</p>
            <p className="text-sm font-extrabold">{COUPLE_TYPE_INFO[result.mine].name[l]}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
            <span className="text-3xl">{COUPLE_TYPE_INFO[result.theirs].emoji}</span>
            <p className="text-xs font-bold text-muted-foreground">{partnerName}</p>
            <p className="text-sm font-extrabold">{COUPLE_TYPE_INFO[result.theirs].name[l]}</p>
          </CardContent>
        </Card>
      </div>
      <TipAndDates type={result.type} />

      <h2 className="mt-2 text-sm font-extrabold text-muted-foreground">
        {t("quiz.compare").replace("{n}", String(sameCount)).replace("{total}", String(QUIZ_LENGTH))}
      </h2>
      <div className="flex flex-col gap-2">
        {QUIZ_QUESTIONS.map((q, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-1.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-extrabold">{q.text[l]}</p>
                {result.same[i] && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-extrabold text-primary">
                    <Check className="h-3 w-3" /> {t("quiz.same")}
                  </span>
                )}
              </div>
              <p className="text-sm">
                <span className="font-bold text-muted-foreground">{t("quiz.you")}:</span> {q.options[mine[i]].text[l]}
              </p>
              {!result.same[i] && (
                <p className="text-sm">
                  <span className="font-bold text-muted-foreground">{partnerName}:</span> {q.options[theirs[i]].text[l]}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="self-center" onClick={onRetake}>
        <RotateCcw className="mr-1 h-4 w-4" /> {t("quiz.retake")}
      </Button>
    </div>
  );
}

function PersonalResult({
  answers,
  partner,
  onRetake,
}: {
  answers: number[];
  partner: QuizState["partner"];
  onRetake: () => void;
}) {
  const { t, lang } = useTranslation();
  const l = lang as QuizLang;
  const type = personalType(answers);
  const info = COUPLE_TYPE_INFO[type];
  return (
    <div className="flex flex-col gap-4">
      <TypeHero type={type} kicker={t("quiz.yourType")} />
      <Card className="border-2 border-dashed border-primary/40">
        <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
          <span className="text-3xl">💌</span>
          {partner ? (
            <>
              <p className="font-extrabold">{t("quiz.waitingTitle").replace("{name}", partner.name)}</p>
              <p className="text-sm text-muted-foreground">{t("quiz.waitingBody")}</p>
            </>
          ) : (
            <>
              <p className="font-extrabold">{t("quiz.soloTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("quiz.soloBody")}</p>
              <Button asChild size="sm" className="mt-1">
                <Link href="/connect">{t("quiz.connect")}</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <ShareStoryButton
        card={{
          emoji: info.emoji,
          kicker: t("quiz.shareKickerSolo"),
          title: info.name[l],
          subtitle: info.description[l],
          chips: info.strengths[l],
        }}
      />
      <TipAndDates type={type} />
      <Button variant="ghost" size="sm" className="self-center" onClick={onRetake}>
        <RotateCcw className="mr-1 h-4 w-4" /> {t("quiz.retake")}
      </Button>
    </div>
  );
}
