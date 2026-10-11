import { useState, useSyncExternalStore } from "react";
import { Navigation } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/i18n";
import {
  directionsUrl,
  getMapsPreference,
  setMapsPreference,
  subscribeMapsPreference,
  type MapsApp,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

const APPS: { id: MapsApp; label: string }[] = [
  { id: "google", label: "Google Maps" },
  { id: "apple", label: "Apple Maps" },
];

// "Directions" link. With a remembered app it's a plain link; otherwise it
// asks which app to use, "just once" or "always" (like Android's app chooser).
// The final buttons are real links, so the app opens from the tap itself.
export function DirectionsLink({ lat, lng, name }: { lat: number; lng: number; name?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<MapsApp | null>(null);
  const linkClass = "flex items-center gap-1 text-xs font-bold text-primary";
  const label = (
    <>
      <Navigation className="h-3.5 w-3.5" /> {t("dates.directions")}
    </>
  );

  const current = useSyncExternalStore(subscribeMapsPreference, getMapsPreference);
  if (current) {
    return (
      <a href={directionsUrl(current, lat, lng, name)} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {label}
      </a>
    );
  }

  // Deferred so the link's own navigation happens before the dialog (and
  // with "always", this whole chooser) unmounts.
  const finish = (always: boolean) =>
    setTimeout(() => {
      setOpen(false);
      if (always && choice) setMapsPreference(choice);
    }, 0);
  const url = choice ? directionsUrl(choice, lat, lng, name) : undefined;
  const actionClass =
    "flex-1 rounded-full py-2.5 text-center text-sm font-bold aria-disabled:pointer-events-none aria-disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        className={linkClass}
        onClick={() => {
          setChoice(null);
          setOpen(true);
        }}
      >
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dates.chooseMapsApp")}</DialogTitle>
            <DialogDescription>{t("dates.mapsAppHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("dates.chooseMapsApp")}>
            {APPS.map((app) => (
              <button
                key={app.id}
                type="button"
                role="radio"
                aria-checked={choice === app.id}
                onClick={() => setChoice(app.id)}
                className={cn(
                  "rounded-2xl border-2 px-4 py-3 text-left font-bold",
                  choice === app.id ? "border-primary bg-primary/10" : "border-border"
                )}
              >
                {app.label}
              </button>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!url}
              onClick={() => finish(false)}
              className={cn(actionClass, "bg-muted text-foreground")}
            >
              {t("dates.justOnce")}
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!url}
              onClick={() => finish(true)}
              className={cn(actionClass, "bg-primary text-primary-foreground")}
            >
              {t("dates.always")}
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
