import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdeaCard } from "@/components/IdeaCard";
import { PlanDateDialog } from "@/components/PlanDateDialog";
import { locationTypeLabel, LOCATION_TYPE_IDS } from "@/lib/dateIdeaFormat";
import { useTranslation } from "@/i18n/i18n";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Coords = { lat: number; lng: number };

// Gets the device position, trying a quick coarse fix first (Wi-Fi/cell,
// fine for "cafés within a few km" and fast indoors) and only then a
// high-accuracy GPS fix. Rejects with the error code so the caller can tell
// "you said no" apart from "the phone couldn't find you" — the old single
// high-accuracy attempt timed out indoors and then showed "access denied"
// to people who had allowed it.
function getPosition(): Promise<Coords> {
  const attempt = (options: PositionOptions) =>
    new Promise<Coords>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        reject,
        options
      )
    );
  return attempt({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }).catch(
    (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) throw err;
      return attempt({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
    }
  );
}

export function NearbySearch() {
  const { t, lang } = useTranslation();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [planIdea, setPlanIdea] = useState<any>(null);

  const { data, isFetching, refetch } = useQuery<{ results: any[]; searchFailed: boolean }>({
    queryKey: ["/api/dates/nearby", coords?.lat, coords?.lng, selectedTypes.join(","), lang],
    queryFn: async () => {
      const params = new URLSearchParams({ lat: String(coords!.lat), lng: String(coords!.lng), lang });
      if (selectedTypes.length) params.set("types", selectedTypes.join(","));
      return apiRequest("GET", `/api/dates/nearby?${params.toString()}`);
    },
    enabled: !!coords,
  });
  const results = data?.results ?? [];
  const searchFailed = data?.searchFailed ?? false;

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const requestLocation = async () => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError(t("dates.locationUnsupported"));
      return;
    }
    setLocating(true);
    try {
      setCoords(await getPosition());
    } catch (err) {
      const denied = (err as GeolocationPositionError).code === 1;
      setLocError(t(denied ? "dates.locationDenied" : "dates.locationUnavailable"));
    } finally {
      setLocating(false);
    }
  };

  const busyLabel = locating ? t("dates.locating") : isFetching ? t("dates.searching") : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {LOCATION_TYPE_IDS.map((id) => (
          <button
            key={id}
            onClick={() => toggleType(id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold",
              selectedTypes.includes(id) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {locationTypeLabel(t, id)}
          </button>
        ))}
      </div>

      {!coords ? (
        <Button onClick={requestLocation} disabled={locating}>
          <MapPin className="h-4 w-4" /> {t("dates.enableLocation")}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          <MapPin className="h-4 w-4" /> {t("dates.findNearby")}
        </Button>
      )}

      {busyLabel && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-2xl bg-muted py-6 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {busyLabel}
        </div>
      )}

      {locError && <p className="text-sm font-semibold text-destructive">{locError}</p>}

      {coords && !isFetching && results.length === 0 && (
        <p className="text-sm text-muted-foreground">{searchFailed ? t("dates.searchFailed") : t("dates.noResults")}</p>
      )}

      {!isFetching && results.some((idea: any) => idea.externalId) && (
        <p className="text-xs text-muted-foreground">{t("dates.livePlacesNote")}</p>
      )}

      {!isFetching && (
        <div className="flex flex-col gap-3">
          {results.map((idea: any) => (
            <IdeaCard key={idea.id} idea={idea} onPlan={setPlanIdea} />
          ))}
        </div>
      )}

      <PlanDateDialog idea={planIdea} open={!!planIdea} onOpenChange={(o) => !o && setPlanIdea(null)} />
    </div>
  );
}
