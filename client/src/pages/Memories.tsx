import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, Trophy, Smile } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReactionBar } from "@/components/ReactionBar";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { MOOD_LEVELS } from "@shared/schema";

type MemoriesData = {
  stats: { moodCount: number; answeredCount: number; completedCount: number; avgMood: number };
  timeline: any[];
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
                <TimelineEntryCard key={i} entry={entry} isMe={entry.userId === user!.id} viewerId={user!.id} />
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

function TimelineEntryCard({ entry, isMe, viewerId }: { entry: any; isMe: boolean; viewerId: string }) {
  const dateLabel = new Date(entry.date).toLocaleDateString("sl-SI", { day: "numeric", month: "long" });
  const who = isMe ? "Ti" : "Partner";

  let icon = <Smile className="h-5 w-5 text-primary" />;
  let content: ReactNode = null;

  if (entry.type === "mood") {
    const level = MOOD_LEVELS.find((m) => m.level === entry.detail.level);
    icon = <span className="text-xl">{level?.emoji}</span>;
    content = (
      <p className="text-sm">
        <strong>{who}</strong> je delil/a razpoloženje: {level?.label}
      </p>
    );
  } else if (entry.type === "answer") {
    icon = <MessageCircle className="h-5 w-5 text-primary" />;
    content = (
      <div>
        <p className="text-sm">
          <strong>{who}</strong> je odgovoril/a na vprašanje{entry.questionText ? `: „${entry.questionText}“` : ""}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{entry.detail.answer}</p>
      </div>
    );
  } else if (entry.type === "challenge") {
    icon = <Trophy className="h-5 w-5 text-primary" />;
    content = (
      <p className="text-sm">
        <strong>{who}</strong> je opravil/a izziv{entry.challengeText ? `: ${entry.challengeText}` : ""}
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1">
          {content}
          <p className="mt-1 text-xs text-muted-foreground">{dateLabel}</p>
          <div className="mt-2">
            <ReactionBar
              targetType={entry.type}
              targetId={entry.detail.id}
              reactions={entry.reactions || []}
              invalidateKeys={[["/api/memories", viewerId]]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
