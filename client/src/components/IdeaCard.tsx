import { MapPin, Clock, CalendarPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { COST_LABELS, DURATION_LABELS, CATEGORY_LABELS } from "@/lib/dateIdeaFormat";
import { useTranslation } from "@/i18n/i18n";

export function IdeaCard({
  idea,
  onPlan,
}: {
  idea: any;
  onPlan: (idea: any) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-extrabold leading-tight">{idea.title}</p>
          <Badge>{CATEGORY_LABELS[idea.category] || idea.category}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{idea.description}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {DURATION_LABELS[idea.duration] || idea.duration}
          </span>
          <span>{COST_LABELS[idea.cost] || idea.cost}</span>
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
        <Button size="sm" variant="secondary" className="mt-1 self-start" onClick={() => onPlan(idea)}>
          <CalendarPlus className="h-4 w-4" />
          {t("dates.planDate")}
        </Button>
      </CardContent>
    </Card>
  );
}
