import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { DirectionsLink } from "@/components/DirectionsLink";

// Loaded lazily from NearbySearch, so Leaflet (and its CSS) only downloads
// for people who open the map.

type Props = {
  center: { lat: number; lng: number };
  radiusKm: number;
  results: any[];
  onPlan: (idea: any) => void;
};

// divIcons instead of Leaflet's default PNG markers: those resolve their
// image URLs relative to the CSS and break under Vite's bundling.
const placeIcon = L.divIcon({
  className: "",
  html: '<div class="h-7 w-7 -translate-x-1/2 -translate-y-full"><svg viewBox="0 0 24 24" class="h-7 w-7 drop-shadow"><path style="fill:hsl(var(--primary))" stroke="white" stroke-width="1.5" d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="white"/></svg></div>',
  iconSize: [0, 0],
  popupAnchor: [0, -28],
});

const centerIcon = L.divIcon({
  className: "",
  html: '<div class="h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow"></div>',
  iconSize: [0, 0],
});

const ZOOM_FOR_RADIUS: Record<number, number> = { 1: 15, 5: 13, 20: 11 };

// Keeps the view on the current results: fit them all when there are some,
// otherwise show the search area.
function FitView({ center, radiusKm, results }: Omit<Props, "onPlan">) {
  const map = useMap();
  useEffect(() => {
    const points = results.filter((r) => r.lat != null && r.lng != null).map((r) => [r.lat, r.lng] as [number, number]);
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds([[center.lat, center.lng], ...points]), { padding: [32, 32], maxZoom: 16 });
    } else {
      map.setView([center.lat, center.lng], ZOOM_FOR_RADIUS[radiusKm] ?? 13);
    }
  }, [map, center.lat, center.lng, radiusKm, results]);
  return null;
}

export default function NearbyMap({ center, radiusKm, results, onPlan }: Props) {
  const { t } = useTranslation();
  const places = useMemo(() => results.filter((r) => r.lat != null && r.lng != null), [results]);

  return (
    // isolate: Leaflet's panes use z-indexes up to 1000; keep them from
    // stacking above the app's dialogs and bottom navigation.
    <div className="isolate h-[60vh] min-h-[320px] overflow-hidden rounded-2xl border">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={ZOOM_FOR_RADIUS[radiusKm] ?? 13}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Circle
          center={[center.lat, center.lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: "#ff6b6b", weight: 1, fillOpacity: 0.05 }}
        />
        <Marker position={[center.lat, center.lng]} icon={centerIcon} interactive={false} />
        {places.map((idea) => (
          <Marker key={idea.id} position={[idea.lat, idea.lng]} icon={placeIcon} title={idea.title}>
            <Popup>
              <div className="flex min-w-[180px] flex-col gap-2 font-sans">
                <div className="text-sm font-extrabold leading-tight">{idea.title}</div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {idea.distanceKm != null && <span>{idea.distanceKm.toFixed(1)} km</span>}
                  {idea.openNow != null && (
                    <span className={idea.openNow ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}>
                      {idea.openNow ? t("dates.openNow") : t("dates.closedNow")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="secondary" onClick={() => onPlan(idea)}>
                    <CalendarPlus className="h-4 w-4" />
                    {t("dates.planDate")}
                  </Button>
                  <DirectionsLink lat={idea.lat} lng={idea.lng} name={idea.title} />
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
