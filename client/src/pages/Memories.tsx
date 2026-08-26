import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, Trophy, Smile, CalendarHeart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReactionBar } from "@/components/ReactionBar";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { bcp47 } from "@/lib/locale";
import { MOOD_LEVELS } from "@shared/schema";

type MemoriesData = {
  stats: { moodCount: number; answeredCount: number; completedCount: number; avgMood: number };
  timeline: any[];
  onThisDay: any[];
  partnerName: string | null;
};

export default function Memories() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<MemoriesData>({ queryKey: ["/api/memories", user!.id] });

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="text-xl font-extrabold">{t("memories.title")}</h1>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Smile} value={data.stats.moodCount} label={t("memories.moodsLogged")} />
            <StatCard icon={MessageCircle} value={data.stats.answeredCount} label={t("memories.questionsAnswered")} />
            <StatCard icon={Trophy} value={data.stats.completedCount} label={t("memories.challengesCompleted")} />
            <StatCard icon={Heart} value={data.stats.avgMood || "–"} label={t("memories.avgMood")} />
          </div>

          {data.onThisDay.length > 0 && (
            <div className="flex flex-col gap-3 rounded-3xl bg-together-warm p-4 text-white">
              <h2 className="flex items-center gap-2 font-extrabold">🕰️ {t("memories.onThisDay")}</h2>
              {data.onThisDay.map((entry, i) => (
                <TimelineEntryCard
                  key={i}
                  entry={entry}
                  isMe={entry.userId === user!.id}
                  viewerId={user!.id}
                  partnerName={data.partnerName}
                  light
                />
              ))}
            </div>
          )}

          <h2 className="mt-2 text-sm font-extrabold text-muted-foreground">{t("memories.recentMemories")}</h2>

          {data.timeline.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="text-4xl">🌱</div>
                <p className="font-extrabold">{t("memories.emptyTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("memories.emptyDesc")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {data.timeline.map((entry, i) => (
                <TimelineEntryCard
                  key={i}
                  entry={entry}
                  isMe={entry.userId === user!.id}
                  viewerId={user!.id}
                  partnerName={data.partnerName}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: any; value: number | string; label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
        <Icon className="h-5 w-5 text-primary" />
        <p className="text-2xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function TimelineEntryCard({
  entry,
  isMe,
  viewerId,
  partnerName,
  light,
}: {
  entry: any;
  isMe: boolean;
  viewerId: string;
  partnerName?: string | null;
  light?: boolean;
}) {
  const { t, lang } = useTranslation();
  const dateLabel = new Date(entry.date).toLocaleDateString(bcp47(lang), { day: "numeric", month: "long" });
  const who = isMe ? t("memories.you") : partnerName || t("memories.partner");
  // Slovenian/Croatian conjugate the "is/are" auxiliary differently for
  // "you" vs a third person's name ("si" vs "je") — English doesn't need it.
  const verb = isMe ? t("memories.verbYou") : t("memories.verbPartner");

  let icon = <Smile className="h-5 w-5 text-primary" />;
  let content: ReactNode = null;

  if (entry.type === "mood") {
    const level = MOOD_LEVELS.find((m) => m.level === entry.detail.level);
    icon = <span className="text-xl">{level?.emoji}</span>;
    content = (
      <p className="text-sm">
        <strong>{who}</strong>{verb && ` ${verb}`} {t("memories.sharedMood")}: {level ? t("mood.level" + level.level) : ""}
      </p>
    );
  } else if (entry.type === "answer") {
    icon = <MessageCircle className={cn("h-5 w-5", light ? "text-white" : "text-primary")} />;
    content = (
      <div>
        <p className="text-sm">
          <strong>{who}</strong>{verb && ` ${verb}`} {t("memories.answeredQuestion")}
          {entry.questionText ? `: „${entry.questionText}“` : ""}
        </p>
        <p className={cn("mt-1 text-sm", light ? "text-white/85" : "text-muted-foreground")}>{entry.detail.answer}</p>
      </div>
    );
  } else if (entry.type === "challenge") {
    icon = <Trophy className={cn("h-5 w-5", light ? "text-white" : "text-primary")} />;
    content = (
      <p className="text-sm">
        <strong>{who}</strong>{verb && ` ${verb}`} {t("memories.completedChallenge")}
        {entry.challengeText ? `: ${entry.challengeText}` : ""}
      </p>
    );
  } else if (entry.type === "date") {
    icon = <CalendarHeart className={cn("h-5 w-5", light ? "text-white" : "text-primary")} />;
    content = (
      <p className="text-sm">
        <strong>{who}</strong>{verb && ` ${verb}`} {t("memories.completedDate")}
        {entry.detail.idea?.title ? `: ${entry.detail.idea.title}` : ""}
      </p>
    );
  }

  return (
    <Card className={light ? "border-white/20 bg-white/15" : undefined}>
      <CardContent className="flex items-start gap-3 py-3">
        <div className="mt-0.5">{icon}</div>
        <div className={cn("flex-1", light && "text-white")}>
          {content}
          <p className={cn("mt-1 text-xs", light ? "text-white/75" : "text-muted-foreground")}>{dateLabel}</p>
          {entry.type !== "date" && (
            <div className="mt-2">
              <ReactionBar
                targetType={entry.type}
                targetId={entry.detail.id}
                reactions={entry.reactions || []}
                invalidateKeys={[["/api/memories", viewerId]]}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
