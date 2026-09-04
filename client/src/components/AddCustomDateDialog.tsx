import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// For a date that isn't in the catalog — the couple types in their own idea
// instead of picking one. Kept as a separate dialog from PlanDateDialog
// rather than a "custom" mode bolted onto it, since the fields (an editable
// title/description vs. a fixed idea) differ enough to make one shared
// component more confusing than two small ones.
export function AddCustomDateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("19:00");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setDate(today);
    setTime("19:00");
    setNotes("");
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/dates/planned/custom", { userId: user!.id, title, description, date, time, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dates/planned", user!.id] });
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      toast({ title: t("dates.planDate") + " ✓" });
      onOpenChange(false);
      reset();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("common.error")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dates.addCustomDate")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-title">{t("dates.customTitle")}</Label>
            <Input
              id="custom-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("dates.customTitlePlaceholder")}
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-description">{t("dates.customDescription")}</Label>
            <Textarea
              id="custom-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("dates.customDescriptionPlaceholder")}
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-date">{t("dates.date")}</Label>
            <Input id="custom-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-time">{t("dates.time")}</Label>
            <Input id="custom-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-notes">{t("dates.notes")}</Label>
            <Textarea
              id="custom-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("dates.notesPlaceholder")}
              rows={2}
            />
          </div>
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("profile.cancel")}
          </Button>
          <Button disabled={mutation.isPending || !title.trim()} onClick={() => mutation.mutate()}>
            {t("dates.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
