import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Check, ChevronLeft, ChevronRight, Sparkles, Dices, Plus, Heart } from "lucide-react";
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
import { AddCustomDateDialog } from "@/components/AddCustomDateDialog";
import { DatePhotoField } from "@/components/DatePhotoField";
import { NearbySearch } from "@/components/NearbySearch";
import { ShareStoryButton } from "@/components/ShareStoryButton";
import { BUCKET_IDEAS } from "@/lib/bucketIdeas";
import { cheer, unlockAudio } from "@/lib/celebrate";
import {
  categoryLabel,
  durationLabel,
  costLabel,
  DATE_CATEGORY_IDS,
  DURATION_IDS,
  COST_IDS,
} from "@/lib/dateIdeaFormat";
import { useTranslation } from "@/i18n/i18n";
import { translations } from "@/i18n/translations";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { bcp47 } from "@/lib/locale";
import { cn } from "@/lib/utils";

const CATEGORIES = DATE_CATEGORY_IDS;

// /dates?tab=wishlist opens the bucket list straight away (Home, pushes).
function initialTab(): string {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "nearby" || tab === "wishlist" || tab === "planned" ? tab : "catalog";
}

export default function Dates() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="text-xl font-extrabold">{t("dates.title")}</h1>
      <Tabs defaultValue={initialTab()}>
        <TabsList className="flex-nowrap justify-start overflow-x-auto">
          <TabsTrigger value="catalog" className="flex-none">{t("dates.catalog")}</TabsTrigger>
          <TabsTrigger value="nearby" className="flex-none">{t("dates.nearby")}</TabsTrigger>
          <TabsTrigger value="planned" className="flex-none">{t("dates.planned")}</TabsTrigger>
          <TabsTrigger value="wishlist" className="flex-none">{t("dates.wishlist")}</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-4">
          <CatalogTab />
        </TabsContent>
        <TabsContent value="nearby" className="mt-4">
          <NearbySearch />
        </TabsContent>
        <TabsContent value="planned" className="mt-4">
          <PlannedTab />
        </TabsContent>
        <TabsContent value="wishlist" className="mt-4">
          <WishlistTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogTab() {
  const { t, lang } = useTranslation();
  const [category, setCategory] = useState("vse");
  const [duration, setDuration] = useState<string>("");
  const [cost, setCost] = useState<string>("");
  const [planIdea, setPlanIdea] = useState<any>(null);
  const [surpriseOpen, setSurpriseOpen] = useState(false);

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["/api/dates/ideas", category, duration, cost, lang],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (duration) params.set("duration", duration);
      if (cost) params.set("cost", cost);
      params.set("lang", lang);
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
  const { t, lang } = useTranslation();
  const [idea, setIdea] = useState<any>(null);

  const rollMutation = useMutation({
    mutationFn: () =>
      apiRequest("GET", `/api/dates/ideas/random?lang=${lang}${idea ? `&exclude=${idea.id}` : ""}`),
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

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PAST_DATES_PREVIEW = 3;

function PlannedTab() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const { data: planned = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/dates/planned", user!.id],
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/dates/planned/${id}`, { userId: user!.id, completed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dates/planned", user!.id] });
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      qc.invalidateQueries({ queryKey: ["/api/memories", user!.id] });
      toast({ title: t("dates.markComplete") + " ✓" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/dates/planned/${id}?userId=${user!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dates/planned", user!.id] });
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      // The date (and its photo) is gone from Memories too.
      qc.invalidateQueries({ queryKey: ["/api/memories", user!.id] });
    },
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
  const monthLabel = viewDate.toLocaleDateString(bcp47(lang), { month: "long", year: "numeric" });
  const weekdayLabels = translations[lang].dates.weekdays;
  const selectedItems = selectedDate ? byDay.get(selectedDate) || [] : [];
  const upcoming = planned.filter((d) => !d.completed);
  // Completed dates used to be visible only by clicking their exact day in
  // the calendar above — easy to lose track of, especially the memory photo
  // attached to them. Surface them as their own section, newest first.
  const past = planned
    .filter((d) => d.completed)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

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
            <Button size="sm" variant="secondary" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(d.id)}>
              <Check className="h-4 w-4" /> {t("dates.markComplete")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={deleteMutation.isPending}
            onClick={() => {
              // Deleting also removes the memory photo, so ask first.
              if (window.confirm(t("dates.confirmDelete"))) deleteMutation.mutate(d.id);
            }}
          >
            <Trash2 className="h-4 w-4" /> {t("dates.delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <Button variant="secondary" onClick={() => setCustomOpen(true)} className="self-start">
        <Plus className="h-4 w-4" /> {t("dates.addCustomDate")}
      </Button>
      <AddCustomDateDialog open={customOpen} onOpenChange={setCustomOpen} />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="rounded-full p-2 hover:bg-muted"
            aria-label={t("dates.prevMonth")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-extrabold capitalize">{monthLabel}</p>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="rounded-full p-2 hover:bg-muted"
            aria-label={t("dates.nextMonth")}
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

        {selectedDate && (
          <div className="flex flex-col gap-2">
            {selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dates.noPlansThisDay")}</p>
            ) : (
              selectedItems.map(renderCard)
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-extrabold text-muted-foreground">{t("dates.upcomingSection")}</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("home.noUpcomingDates")}</p>
        ) : (
          upcoming.map(renderCard)
        )}
      </div>

      {!isLoading && past.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-extrabold text-muted-foreground">{t("dates.pastSection")}</h2>
          {(showAllPast ? past : past.slice(0, PAST_DATES_PREVIEW)).map(renderCard)}
          {!showAllPast && past.length > PAST_DATES_PREVIEW && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAllPast(true)}>
              {t("memories.seeMore")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

type BucketItem = {
  id: number;
  text: string;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  photo: string | null;
  createdAt: string;
};

const IDEAS_SHOWN = 6;

// The couple's bucket list: things to do together someday. Ticking one off
// is a little celebration, and the done ones keep a photo and can be shared.
function WishlistTab() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [ideaPage, setIdeaPage] = useState(0);

  const queryKey = ["/api/wishlist", user!.id];
  const { data: items = [], isLoading } = useQuery<BucketItem[]>({ queryKey });
  const { data: home } = useQuery<{ partner: { name: string } | null }>({ queryKey: ["/api/home", user!.id] });
  const partnerName = home?.partner?.name ?? t("memories.partner");
  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["/api/memories", user!.id] });
  };

  const addMutation = useMutation({
    mutationFn: (value: string) => apiRequest("POST", "/api/wishlist", { userId: user!.id, text: value }),
    onSuccess: () => {
      setText("");
      invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      apiRequest("PATCH", `/api/wishlist/${id}`, { userId: user!.id, completed }),
    onSuccess: (_d, v) => {
      if (v.completed) cheer();
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/wishlist/${id}?userId=${user!.id}`),
    onSuccess: invalidate,
  });

  const pending = items.filter((i) => !i.completed);
  const completed = items
    .filter((i) => i.completed)
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime());
  const existing = new Set(items.map((i) => i.text.trim().toLowerCase()));
  const ideas = BUCKET_IDEAS.map((i) => i[lang]).filter((i) => !existing.has(i.toLowerCase()));
  const pages = Math.max(1, Math.ceil(ideas.length / IDEAS_SHOWN));
  const page = ideaPage % pages;
  const shownIdeas = ideas.slice(page * IDEAS_SHOWN, page * IDEAS_SHOWN + IDEAS_SHOWN);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-3xl bg-together-warm p-4 text-white shadow-md">
        <p className="text-lg font-extrabold">🗺️ {t("bucket.title")}</p>
        <p className="text-sm text-white/90">{t("bucket.subtitle")}</p>
        {items.length > 0 && (
          <>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${(completed.length / items.length) * 100}%` }} />
            </div>
            <p className="text-xs font-extrabold">
              {t("bucket.progress").replace("{n}", String(completed.length)).replace("{total}", String(items.length))}
            </p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("dates.wishlistPlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim() && !addMutation.isPending) addMutation.mutate(text);
          }}
        />
        <Button
          size="icon"
          disabled={!text.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate(text)}
          aria-label={t("dates.wishlistPlaceholder")}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {shownIdeas.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-muted-foreground">✨ {t("bucket.ideas")}</p>
            {pages > 1 && (
              <button className="text-xs font-bold text-primary" onClick={() => setIdeaPage(page + 1)}>
                {t("bucket.moreIdeas")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {shownIdeas.map((idea) => (
              <button
                key={idea}
                disabled={addMutation.isPending}
                onClick={() => addMutation.mutate(idea)}
                className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-left text-xs font-bold text-primary active:scale-95"
              >
                + {idea}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
          <Heart className="h-8 w-8" />
          <p className="text-sm">{t("dates.wishlistEmpty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <button
                  onClick={() => {
                    unlockAudio();
                    toggleMutation.mutate({ id: item.id, completed: true });
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 active:scale-90"
                  aria-label={t("dates.markComplete")}
                />
                <p className="min-w-0 flex-1 break-words text-sm">{item.text}</p>
                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  className="rounded-full p-2 text-muted-foreground hover:text-destructive"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
          {completed.length > 0 && (
            <>
              <p className="mt-2 text-xs font-bold text-muted-foreground">🎉 {t("bucket.done")}</p>
              {completed.map((item) => {
                const who = item.completedBy === user!.id ? t("memories.you") : partnerName;
                const when = item.completedAt
                  ? new Date(item.completedAt).toLocaleDateString(bcp47(lang), { day: "numeric", month: "long", year: "numeric" })
                  : "";
                return (
                  <Card key={item.id} className="border-primary/30 bg-primary/5">
                    <CardContent className="flex flex-col gap-3 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleMutation.mutate({ id: item.id, completed: false })}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          aria-label={t("dates.markIncomplete")}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold">{item.text}</p>
                          {when && (
                            <p className="text-xs text-muted-foreground">
                              {t("bucket.doneOn").replace("{date}", when).replace("{who}", who)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="rounded-full p-2 text-muted-foreground hover:text-destructive"
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <DatePhotoField
                        plannedDateId={item.id}
                        endpoint={`/api/wishlist/${item.id}`}
                        photo={item.photo}
                        invalidateKeys={[queryKey, ["/api/memories", user!.id]]}
                      />
                      <ShareStoryButton
                        className="self-start"
                        card={{
                          emoji: "✅",
                          kicker: t("bucket.shareKicker"),
                          title: item.text,
                          subtitle: when,
                          photo: item.photo,
                        }}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
