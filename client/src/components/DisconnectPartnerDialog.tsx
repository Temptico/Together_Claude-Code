import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HeartOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

export function DisconnectPartnerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => apiRequest<User>("POST", "/api/partner/disconnect", { userId: user!.id }),
    onSuccess: (updated) => {
      setUser(updated);
      qc.invalidateQueries();
      onOpenChange(false);
      toast({ title: t("profile.partnerDisconnected") });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("common.error")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartOff className="h-5 w-5 text-destructive" /> {t("profile.disconnectPartner")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("profile.disconnectPartnerWarning")}</p>
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("profile.cancel")}
          </Button>
          <Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("profile.disconnectPartnerConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
