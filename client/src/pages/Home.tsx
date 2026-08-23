import { Link } from "wouter";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Flame, Settings, Trophy, MessageCircle, CalendarHeart, ChevronRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReactionBar } from "@/components/ReactionBar";
import { NotificationOptInDialog } from "@/components/NotificationOptInDialog";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MOOD_LEVELS } from "@shared/schema";

type HomeData = {
  user: any;
  partner: any | null;
  streak: number;
  myMood: any | null;
  partnerMood: any | null;
  question: any | null;
  myAnswer: any | null;
  challenge: any | null;
  challengeCompleted: boolean;
  upcomingDates: any[];
  anniversaryCountdown: { daysUntil: number; isToday: boolean; years: number } | null;
};

export default function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<HomeData>({
    queryKey: ["/api/home", user!.id],
    // Polls so a partner's mood/answer/challenge shows up without a manual
    // refresh — push notifications cover the closed-app case, this covers
    // the tab-already-open case.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  // Viewing Home counts as having seen the partner's latest mood — clears
  // the BottomNav badge for it. BottomNav doesn't share React state with
  // this component, so a custom event nudges it to re-check localStorage
  // right away instead of waiting for its next query refetch.
  useEffect(() => {
    if (data?.partnerMood) {
      localStorage.setItem("together:lastSeenPartnerMoodId", String(data.partnerMood.id));
      window.dispatchEvent(new Event("together:partnerMoodSeen"));
    }
  }, [data?.partnerMood?.id]);

  if (isLoading || !data) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-3xl animate-pulse">💗</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <HomeHeader data={data} />
      {data.anniversaryCountdown && <AnniversaryCountdownCard countdown={data.anniversaryCountdown} />}
      {!data.partner && <ConnectBanner />}
      {data.partner && <PartnerMoodCard mood={data.partnerMood} userId={data.user.id} />}
      <MoodCheckIn myMood={data.myMood} userId={data.user.id} />
      <DailyQuestionCard question={data.question} myAnswer={data.myAnswer} />
      <DailyChallengeCard
        challenge={data.challenge}
        completed={data.challengeCompleted}
        userId={data.user.id}
      />
      <UpcomingDatesCard dates={data.upcomingDates} />
      <NotificationOptInDialog />
    </div>
  );
}

function HomeHeader({ data }: { data: HomeData }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between rounded-3xl bg-together-warm p-4 text-white shadow-md">
      <div>
        <p className="text-lg font-extrabold">{data.user.name}</p>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
          <Heart className={`h-3.5 w-3.5 ${data.partner ? "fill-white" : ""}`} />
          {data.partner ? t("home.connected") : t("home.notConnected")}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-white/25 px-3 py-1.5 text-sm font-extrabold">
          <Flame className="h-4 w-4" />
          {data.streak}
        </div>
        <Link href="/profile" className="rounded-full bg-white/25 p-2">
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}

function AnniversaryCountdownCard({
  countdown,
}: {
  countdown: { daysUntil: number; isToday: boolean; years: number };
}) {
  const { t } = useTranslation();
  return (
    <Card className="bg-together-gradient text-white">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="text-3xl">💍</div>
        {countdown.isToday ? (
          <p className="font-extrabold">{t("home.anniversaryToday")}</p>
        ) : (
          <div>
            <p className="text-2xl font-extrabold leading-none">
              {countdown.daysUntil} {t("home.days")}
            </p>
            <p className="text-xs font-semibold text-white/90">
              {t("home.anniversaryIn")} · {countdown.years} {t("home.anniversaryYears")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectBanner() {
  const { t } = useTranslation();
  return (
    <Link href="/connect">
      <Card className="border-2 border-dashed border-primary/40 bg-primary/5">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-extrabold text-primary">{t("partner.connectTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("home.notConnected")}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-primary" />
        </CardContent>
      </Card>
    </Link>
  );
}

function PartnerMoodCard({ mood, userId }: { mood: any; userId: string }) {
  const { t } = useTranslation();
  const level = mood ? MOOD_LEVELS.find((m) => m.level === mood.level) : null;

  const messages: Record<number, string> = {
    1: "Partner ima težek dan in bi potreboval/a nekaj podpore.",
    2: "Partner bi potreboval/a malo spodbude.",
    3: "Partner se počuti v redu.",
    4: "Partner je dobre volje.",
    5: "Partner se počuti odlično!",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("home.partnerMoodTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {level ? (
          <>
            <div className="flex items-center gap-3">
              <div className="text-4xl">{level.emoji}</div>
              <div>
                <p className="text-sm font-semibold">{messages[level.level]}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(mood.createdAt).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            <ReactionBar
              targetType="mood"
              targetId={mood.id}
              reactions={mood.reactions || []}
              invalidateKeys={[["/api/home", userId]]}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("home.noMoodYet")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MoodCheckIn({ myMood, userId }: { myMood: any; userId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (level: number) => apiRequest("POST", "/api/mood", { userId, level }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/home", userId] });
      qc.invalidateQueries({ queryKey: ["/api/memories", userId] });
      toast({ title: t("home.moodSubmitted") });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{myMood ? t("home.alreadyShared") : t("home.howAreYouToday")}</CardTitle>
      </CardHeader>
      <CardContent>
        {myMood ? (
          <div className="flex justify-center py-2 text-5xl">
            {MOOD_LEVELS.find((m) => m.level === myMood.level)?.emoji}
          </div>
        ) : (
          <div className="flex justify-between gap-1">
            {MOOD_LEVELS.map((m) => (
              <button
                key={m.level}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(m.level)}
                className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-3xl transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                aria-label={m.label}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DailyQuestionCard({ question, myAnswer }: { question: any; myAnswer: any }) {
  const { t } = useTranslation();
  if (!question) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <MessageCircle className="h-5 w-5 text-primary" />
        <CardTitle>{t("home.dailyQuestion")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{question.text}</p>
        {myAnswer ? (
          <div className="rounded-2xl bg-muted p-3">
            <p className="text-xs font-bold text-muted-foreground">{t("home.alreadyAnswered")}</p>
            <p className="mt-1 text-sm">{myAnswer.answer}</p>
          </div>
        ) : (
          <Button asChild size="sm" className="self-start">
            <Link href="/question">{t("home.answer")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function DailyChallengeCard({
  challenge,
  completed,
  userId,
}: {
  challenge: any;
  completed: boolean;
  userId: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/challenge/complete", { userId, challengeId: challenge.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/home", userId] });
      qc.invalidateQueries({ queryKey: ["/api/memories", userId] });
      toast({ title: t("home.challengeCompleted") });
    },
  });

  if (!challenge) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <CardTitle>{t("home.dailyChallenge")}</CardTitle>
        </div>
        <Badge variant="accent">{challenge.category}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{challenge.text}</p>
        {completed ? (
          <div className="flex items-center gap-2 self-start rounded-full bg-primary/15 px-4 py-2 text-sm font-bold text-primary">
            <Check className="h-4 w-4" /> {t("home.challengeCompleted")}
          </div>
        ) : (
          <Button size="sm" className="self-start" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("home.acceptChallenge")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingDatesCard({ dates }: { dates: any[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <CalendarHeart className="h-5 w-5 text-primary" />
        <CardTitle>{t("home.upcomingDates")}</CardTitle>
      </CardHeader>
      <CardContent>
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("home.noUpcomingDates")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {dates.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-2xl bg-muted p-3">
                <div>
                  <p className="text-sm font-bold">{d.idea?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.scheduledAt).toLocaleDateString("sl-SI", { day: "numeric", month: "long" })}
                  </p>
                </div>
                <Badge>{d.idea?.category}</Badge>
              </div>
            ))}
          </div>
        )}
        <Link href="/dates" className="mt-3 inline-block text-sm font-bold text-primary">
          {t("dates.title")} →
        </Link>
      </CardContent>
    </Card>
  );
}
