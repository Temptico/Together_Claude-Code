import { MapPin, Clock, CalendarPlus, Map, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { costLabel, durationLabel, categoryLabel } from "@/lib/dateIdeaFormat";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export function IdeaCard({
  idea,
  onPlan,
}: {
  idea: any;
  onPlan: (idea: any) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isTemptico = idea.tags?.includes("temptico");
  const trackClick = () => {
    if (!isTemptico || !user) return;
    apiRequest("POST", "/api/track/temptico-click", { userId: user.id, source: "date_idea" }).catch(() => {});
  };
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-extrabold leading-tight">{idea.title}</p>
          <Badge>{categoryLabel(t, idea.category)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{idea.description}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {durationLabel(t, idea.duration)}
          </span>
          <span>{costLabel(t, idea.cost)}</span>
          {idea.distanceKm != null && (
            <span className="flex items-center gap-1 text-primary">
              <MapPin className="h-3.5 w-3.5" /> {idea.distanceKm.toFixed(1)} km
            </span>
          )}
          {idea.city && !idea.distanceKm && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {idea.city}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => onPlan(idea)}>
            <CalendarPlus className="h-4 w-4" />
            {t("dates.planDate")}
          </Button>
          {idea.lat != null && idea.lng != null && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${idea.lat},${idea.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-bold text-primary"
            >
              <Map className="h-3.5 w-3.5" /> {t("dates.viewMap")}
            </a>
          )}
          {idea.website && (
            <a
              href={idea.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackClick}
              className="flex items-center gap-1 text-xs font-bold text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {t("dates.website")}
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
