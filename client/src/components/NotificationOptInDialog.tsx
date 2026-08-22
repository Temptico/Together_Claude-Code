import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { subscribeToPush } from "@/hooks/use-push";
import type { User } from "@shared/schema";

const DISMISSED_KEY = "together:notifPromptShown";

// A one-time, friendly ask for notification permission — shown once a user
// has a connected partner (that's when notifications actually become useful)
// instead of firing the browser's native prompt unprompted on page load,
// which browsers block silently and users reflexively deny.
export function NotificationOptInDialog() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.partnerId) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (!("Notification" in window) || Notification.permission !== "default") {
      localStorage.setItem(DISMISSED_KEY, "1");
      return;
    }
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.partnerId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const ok = await subscribeToPush(user!.id);
      if (ok) return apiRequest<User>("PATCH", `/api/users/${user!.id}`, { notificationsEnabled: true });
      return null;
    },
    onSuccess: (updated) => {
      if (updated) setUser(updated);
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      localStorage.setItem(DISMISSED_KEY, "1");
      setOpen(false);
    },
    onError: () => {
      localStorage.setItem(DISMISSED_KEY, "1");
      setOpen(false);
    },
  });

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> {t("profile.notifications")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("home.notifPromptBody")}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={dismiss}>
            {t("home.notifPromptLater")}
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("home.notifPromptEnable")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
