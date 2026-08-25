import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Check, MapPin, ChevronLeft, ChevronRight, Sparkles, Dices, Plus, Heart } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { IdeaCard } from "@/components/IdeaCard";
import { PlanDateDialog } from "@/components/PlanDateDialog";
import { DatePhotoField } from "@/components/DatePhotoField";
import {
  categoryLabel,
  durationLabel,
  costLabel,
  locationTypeLabel,
  DATE_CATEGORY_IDS,
  DURATION_IDS,
  COST_IDS,
  LOCATION_TYPE_IDS,
} from "@/lib/dateIdeaFormat";
import { useTranslation } from "@/i18n/i18n";
import { translations } from "@/i18n/translations";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { bcp47 } from "@/lib/locale";
import { cn } from "@/lib/utils";

const CATEGORIES = DATE_CATEGORY_IDS;

export default function Dates() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="text-xl font-extrabold">{t("dates.title")}</h1>
      <Tabs defaultValue="catalog">
        <TabsList className="flex-nowrap justify-start overflow-x-auto">
          <TabsTrigger value="catalog" className="flex-none">{t("dates.catalog")}</TabsTrigger>
          <TabsTrigger value="nearby" className="flex-none">{t("dates.nearby")}</TabsTrigger>
          <TabsTrigger value="planned" className="flex-none">{t("dates.planned")}</TabsTrigger>
          <TabsTrigger value="calendar" className="flex-none">{t("dates.calendar")}</TabsTrigger>
          <TabsTrigger value="wishlist" className="flex-none">{t("dates.wishlist")}</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-4">
          <CatalogTab />
        </TabsContent>
        <TabsContent value="nearby" className="mt-4">
          <NearbyTab />
        </TabsContent>
        <TabsContent value="planned" className="mt-4">
          <PlannedTab />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <CalendarTab />
        </TabsContent>
        <TabsContent value="wishlist" className="mt-4">
          <WishlistTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogTab() {
  const { t } = useTranslation();
  const [category, setCategory] = useState("vse");
  const [duration, setDuration] = useState<string>("");
  const [cost, setCost] = useState<string>("");
  const [planIdea, setPlanIdea] = useState<any>(null);
  const [surpriseOpen, setSurpriseOpen] = useState(false);

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["/api/dates/ideas", category, duration, cost],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (duration) params.set("duration", duration);
      if (cost) params.set("cost", cost);
      return apiRequest("GET", `/api/dates/ideas?${params.toString()}`);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" onClick={() => setSurpriseOpen(true)} className="self-start">
        <Dices className="h-4 w-4" /> {t("home.surpriseMe")}
      </Button>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-bold",
              category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {categoryLabel(t, c)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Select value={duration || "any"} onValueChange={(v) => setDuration(v === "any" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("dates.duration")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("dates.duration")}</SelectItem>
            {DURATION_IDS.map((value) => (
              <SelectItem key={value} value={value}>
                {durationLabel(t, value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cost || "any"} onValueChange={(v) => setCost(v === "any" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("dates.cost")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("dates.cost")}</SelectItem>
            {COST_IDS.map((value) => (
              <SelectItem key={value} value={value}>
                {costLabel(t, value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : ideas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("dates.noResults")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {ideas.map((idea: any) => (
            <IdeaCard key={idea.id} idea={idea} onPlan={setPlanIdea} />
          ))}
        </div>
      )}

      <PlanDateDialog idea={planIdea} open={!!planIdea} onOpenChange={(o) => !o && setPlanIdea(null)} />
      <SurpriseDialog open={surpriseOpen} onOpenChange={setSurpriseOpen} onPlan={setPlanIdea} />
    </div>
  );
}

function SurpriseDialog({
  open,
  onOpenChange,
  onPlan,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPlan: (idea: any) => void;
}) {
  const { t } = useTranslation();
  const [idea, setIdea] = useState<any>(null);

  const rollMutation = useMutation({
    mutationFn: () => apiRequest("GET", `/api/dates/ideas/random${idea ? `?exclude=${idea.id}` : ""}`),
    onSuccess: (result) => setIdea(result),
  });

  useEffect(() => {
    if (open && !idea) rollMutation.mutate();
    if (!open) setIdea(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {t("home.surpriseMe")}
          </DialogTitle>
        </DialogHeader>
        {idea && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-lg font-extrabold">{idea.title}</p>
                <Badge>{categoryLabel(t, idea.category)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{idea.description}</p>
              <div className="mt-2 flex gap-3 text-xs font-bold text-muted-foreground">
                <span>{durationLabel(t, idea.duration)}</span>
                <span>{costLabel(t, idea.cost)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => rollMutation.mutate()} disabled={rollMutation.isPending}>
                <Dices className="h-4 w-4" /> {t("dates.rollAgain")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  onPlan(idea);
                  onOpenChange(false);
                }}
              >
                {t("dates.planDate")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NearbyTab() {
  const { t } = useTranslation();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [planIdea, setPlanIdea] = useState<any>(null);

  const { data, isFetching, refetch } = useQuery<{ results: any[]; searchFailed: boolean }>({
    queryKey: ["/api/dates/nearby", coords?.lat, coords?.lng, selectedTypes.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams({ lat: String(coords!.lat), lng: String(coords!.lng) });
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

  const requestLocation = () => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError(t("dates.locationDenied"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocError(t("dates.locationDenied")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
        <Button onClick={requestLocation}>
          <MapPin className="h-4 w-4" /> {t("dates.enableLocation")}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          <MapPin className="h-4 w-4" /> {t("dates.findNearby")}
        </Button>
      )}

      {locError && <p className="text-sm font-semibold text-destructive">{locError}</p>}

      {coords && !isFetching && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {searchFailed ? t("dates.searchFailed") : t("dates.noResults")}
        </p>
      )}

      {results.some((idea: any) => idea.externalId) && (
        <p className="text-xs text-muted-foreground">{t("dates.livePlacesNote")}</p>
      )}

      <div className="flex flex-col gap-3">
        {results.map((idea: any) => (
          <IdeaCard key={idea.id} idea={idea} onPlan={setPlanIdea} />
        ))}
      </div>

      <PlanDateDialog idea={planIdea} open={!!planIdea} onOpenChange={(o) => !o && setPlanIdea(null)} />
    </div>
  );
}

function PlannedTab() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: planned = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/dates/planned", user!.id],
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/dates/planned/${id}`, { userId: user!.id, completed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dates/planned", user!.id] });
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      toast({ title: t("dates.markComplete") + " ✓" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/dates/planned/${id}?userId=${user!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dates/planned", user!.id] });
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (planned.length === 0) return <p className="text-sm text-muted-foreground">{t("home.noUpcomingDates")}</p>;

  const upcoming = planned.filter((d) => !d.completed);
  const past = planned.filter((d) => d.completed);

  const renderCard = (d: any) => (
    <Card key={d.id}>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-extrabold">{d.idea?.title}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(d.scheduledAt).toLocaleString(bcp47(lang), {
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {d.completed ? (
            <Badge variant="default">{t("dates.completed")}</Badge>
          ) : (
            <Badge variant="secondary">{d.idea?.category ? categoryLabel(t, d.idea.category) : ""}</Badge>
          )}
        </div>
        {d.notes && <p className="text-sm text-muted-foreground">{d.notes}</p>}
        <DatePhotoField plannedDateId={d.id} photo={d.photo} invalidateKeys={[["/api/dates/planned", user!.id]]} />
        <div className="flex gap-2">
          {!d.completed && (
            <Button size="sm" variant="secondary" onClick={() => completeMutation.mutate(d.id)}>
              <Check className="h-4 w-4" /> {t("dates.markComplete")}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(d.id)}>
            <Trash2 className="h-4 w-4" /> {t("dates.delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-5">
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-extrabold text-muted-foreground">{t("dates.upcomingSection")}</h2>
          {upcoming.map(renderCard)}
        </div>
      )}
      {past.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-extrabold text-muted-foreground">{t("dates.pastSection")}</h2>
          {past.map(renderCard)}
        </div>
      )}
    </div>
  );
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarTab() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: planned = [] } = useQuery<any[]>({
    queryKey: ["/api/dates/planned", user!.id],
  });

  const byDay = new Map<string, any[]>();
  for (const d of planned) {
    const key = dateKey(new Date(d.scheduledAt));
    byDay.set(key, [...(byDay.get(key) || []), d]);
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = dateKey(new Date());
  const monthLabel = viewDate.toLocaleDateString(bcp47(lang), {
    month: "long",
    year: "numeric",
  });
  const weekdayLabels = translations[lang].dates.weekdays;

  const selectedItems = selectedDate ? byDay.get(selectedDate) || [] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="rounded-full p-2 hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-extrabold capitalize">{monthLabel}</p>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="rounded-full p-2 hover:bg-muted"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">
        {weekdayLabels.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = dateKey(d);
          const hasPlans = byDay.has(key);
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(key)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold",
                isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-muted" : "hover:bg-muted"
              )}
            >
              {d.getDate()}
              {hasPlans && (
                <span className={cn("h-1.5 w-1.5 rounded-full", isSelected ? "bg-primary-foreground" : "bg-primary")} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {selectedDate && selectedItems.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("dates.noPlansThisDay")}</p>
        )}
        {selectedItems.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{d.idea?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.scheduledAt).toLocaleTimeString(bcp47(lang), { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {d.completed ? (
                  <Badge>{t("dates.completed")}</Badge>
                ) : (
                  <Badge variant="secondary">{d.idea?.category ? categoryLabel(t, d.idea.category) : ""}</Badge>
                )}
              </div>
              <DatePhotoField
                plannedDateId={d.id}
                photo={d.photo}
                invalidateKeys={[["/api/dates/planned", user!.id]]}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WishlistTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const queryKey = ["/api/wishlist", user!.id];
  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/wishlist", { userId: user!.id, text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      apiRequest("PATCH", `/api/wishlist/${id}`, { userId: user!.id, completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/wishlist/${id}?userId=${user!.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const pending = items.filter((i) => !i.completed);
  const completed = items.filter((i) => i.completed);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("dates.wishlistPlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) addMutation.mutate();
          }}
        />
        <Button size="icon" disabled={!text.trim() || addMutation.isPending} onClick={() => addMutation.mutate()}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <Heart className="h-8 w-8" />
          <p className="text-sm">{t("dates.wishlistEmpty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <button
                  onClick={() => toggleMutation.mutate({ id: item.id, completed: true })}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary/40"
                  aria-label={t("dates.markComplete")}
                />
                <p className="flex-1 text-sm">{item.text}</p>
                <button onClick={() => deleteMutation.mutate(item.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
          {completed.length > 0 && (
            <>
              <p className="mt-2 text-xs font-bold text-muted-foreground">{t("dates.completed")}</p>
              {completed.map((item) => (
                <Card key={item.id} className="opacity-60">
                  <CardContent className="flex items-center gap-3 py-3">
                    <button
                      onClick={() => toggleMutation.mutate({ id: item.id, completed: false })}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      aria-label={t("dates.markComplete")}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <p className="flex-1 text-sm line-through">{item.text}</p>
                    <button onClick={() => deleteMutation.mutate(item.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
