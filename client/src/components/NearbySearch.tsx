import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LocateFixed, MapPin, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { IdeaCard } from "@/components/IdeaCard";
import { PlanDateDialog } from "@/components/PlanDateDialog";
import { locationTypeLabel, LOCATION_TYPE_IDS } from "@/lib/dateIdeaFormat";
import { useTranslation } from "@/i18n/i18n";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Coords = { lat: number; lng: number };
// Where the search is centered: the device position (label null) or a place
// the user searched for by name.
type Center = Coords & { label: string | null };
type GeocodeResult = { name: string; label: string; lat: number; lng: number };

const RADII_KM = [1, 5, 20] as const;
const DEFAULT_RADIUS_KM = 5;
const STORAGE_KEY = "together:nearby";

// The last center and radius are remembered so reopening the tab searches
// right away instead of asking for location again. Storage can be missing
// or throw (private mode, blocked site data) — then it just starts fresh.
function loadSaved(): { center: Center | null; radiusKm: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const c = saved?.center;
    const center =
      c && Number.isFinite(c.lat) && Number.isFinite(c.lng)
        ? { lat: c.lat, lng: c.lng, label: typeof c.label === "string" ? c.label : null }
        : null;
    const radiusKm = (RADII_KM as readonly number[]).includes(saved?.radiusKm) ? saved.radiusKm : DEFAULT_RADIUS_KM;
    return { center, radiusKm };
  } catch {
    return { center: null, radiusKm: DEFAULT_RADIUS_KM };
  }
}

function save(center: Center | null, radiusKm: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ center, radiusKm }));
  } catch {
    // Not remembering is fine.
  }
}

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
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [initial] = useState(loadSaved);
  const [center, setCenterState] = useState<Center | null>(initial.center);
  const [radiusKm, setRadiusState] = useState<number>(initial.radiusKm);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<GeocodeResult[] | null>(null);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [planIdea, setPlanIdea] = useState<any>(null);

  const { data, isFetching, refetch } = useQuery<{ results: any[]; searchFailed: boolean }>({
    queryKey: ["/api/dates/nearby", center?.lat, center?.lng, radiusKm, selectedTypes.join(","), lang],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(center!.lat),
        lng: String(center!.lng),
        radius: String(radiusKm),
        lang,
      });
      if (selectedTypes.length) params.set("types", selectedTypes.join(","));
      return apiRequest("GET", `/api/dates/nearby?${params.toString()}`);
    },
    enabled: !!center,
  });
  const allResults = data?.results ?? [];
  // Places without opening hours in OSM are unknown, not closed — but "open
  // now only" means ones we know are open.
  const results = onlyOpen ? allResults.filter((idea: any) => idea.openNow === true) : allResults;
  const searchFailed = data?.searchFailed ?? false;

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setCenter = (next: Center) => {
    setCenterState(next);
    save(next, radiusKm);
  };

  const setRadius = (km: number) => {
    setRadiusState(km);
    save(center, km);
  };

  const pickPlace = (place: GeocodeResult) => {
    setPlaceResults(null);
    setPlaceQuery("");
    setLocError(null);
    setCenter({ lat: place.lat, lng: place.lng, label: place.name });
  };

  const searchPlace = async (e: FormEvent) => {
    e.preventDefault();
    const q = placeQuery.trim();
    if (q.length < 2) return;
    setPlaceError(null);
    setPlaceResults(null);
    setPlaceSearching(true);
    try {
      const { results } = await apiRequest<{ results: GeocodeResult[] }>(
        "GET",
        `/api/geocode?${new URLSearchParams({ q, lang }).toString()}`
      );
      if (results.length === 0) setPlaceError(t("dates.placeNotFound"));
      else if (results.length === 1) pickPlace(results[0]);
      else setPlaceResults(results);
    } catch {
      setPlaceError(t("dates.placeSearchFailed"));
    } finally {
      setPlaceSearching(false);
    }
  };

  const requestLocation = async () => {
    setLocError(null);
    setPlaceError(null);
    setPlaceResults(null);
    if (!navigator.geolocation) {
      setLocError(t("dates.locationUnsupported"));
      return;
    }
    setLocating(true);
    try {
      setCenter({ ...(await getPosition()), label: null });
    } catch (err) {
      const denied = (err as GeolocationPositionError).code === 1;
      setLocError(t(denied ? "dates.locationDenied" : "dates.locationUnavailable"));
    } finally {
      setLocating(false);
    }
  };

  const busyLabel = locating ? t("dates.locating") : placeSearching || isFetching ? t("dates.searching") : null;

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

      <form onSubmit={searchPlace} className="flex gap-2">
        <Input
          value={placeQuery}
          onChange={(e) => setPlaceQuery(e.target.value)}
          placeholder={t("dates.placeSearchPlaceholder")}
          aria-label={t("dates.placeSearchPlaceholder")}
          enterKeyHint="search"
          maxLength={200}
        />
        <Button
          type="submit"
          size="icon"
          aria-label={t("dates.placeSearch")}
          disabled={placeSearching || placeQuery.trim().length < 2}
        >
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {placeResults && (
        <div className="flex flex-col gap-1 rounded-2xl border p-2">
          <p className="px-2 pt-1 text-xs font-bold text-muted-foreground">{t("dates.choosePlace")}</p>
          {placeResults.map((place) => (
            <button
              key={`${place.lat},${place.lng}`}
              onClick={() => pickPlace(place)}
              className="rounded-xl px-2 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="font-semibold">{place.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{place.label}</span>
            </button>
          ))}
        </div>
      )}

      {placeError && <p className="text-sm font-semibold text-destructive">{placeError}</p>}

      <Button variant={center ? "secondary" : "default"} onClick={requestLocation} disabled={locating}>
        <LocateFixed className="h-4 w-4" /> {center ? t("dates.useMyLocation") : t("dates.enableLocation")}
      </Button>

      {center && (
        <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="shrink-0 text-muted-foreground">{t("dates.searchingAround")}</span>
              <span className="truncate font-bold">{center.label ?? t("dates.myLocation")}</span>
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label={t("dates.findNearby")}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label={t("dates.radius")}>
            <span className="text-xs font-bold text-muted-foreground">{t("dates.radius")}</span>
            {RADII_KM.map((km) => (
              <button
                key={km}
                onClick={() => setRadius(km)}
                aria-pressed={radiusKm === km}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold",
                  radiusKm === km ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                )}
              >
                {km} km
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
            {t("dates.onlyOpenNow")}
            <Switch checked={onlyOpen} onCheckedChange={setOnlyOpen} />
          </label>
        </div>
      )}

      {busyLabel && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-2xl bg-muted py-6 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {busyLabel}
        </div>
      )}

      {locError && <p className="text-sm font-semibold text-destructive">{locError}</p>}

      {center && !isFetching && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {allResults.length > 0 ? t("dates.noOpenResults") : searchFailed ? t("dates.searchFailed") : t("dates.noResults")}
        </p>
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
