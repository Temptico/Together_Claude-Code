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

export function PlanDateDialog({
  idea,
  open,
  onOpenChange,
}: {
  idea: { id: number; title: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("19:00");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/dates/planned", { userId: user!.id, ideaId: idea!.id, date, time, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dates/planned", user!.id] });
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      toast({ title: t("dates.planDate") + " ✓" });
      onOpenChange(false);
      setNotes("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("common.error")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{idea?.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="date">{t("dates.date")}</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="time">{t("dates.time")}</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">{t("dates.notes")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("dates.notesPlaceholder")}
              rows={3}
            />
          </div>
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("profile.cancel")}
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("dates.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
