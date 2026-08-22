import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Bell,
  Download,
  Globe,
  LogOut,
  FileText,
  HelpCircle,
  Pencil,
  ChevronRight,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditProfileDialog } from "@/components/EditProfileDialog";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { subscribeToPush } from "@/hooks/use-push";
import type { User } from "@shared/schema";

const REMINDER_TIMES = ["random", "08:00", "09:00", "10:00", "11:00", "12:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

export default function Profile() {
  const { t, lang, setLang } = useTranslation();
  const { user, setUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { canInstall, install } = usePwaInstall();
  const [editOpen, setEditOpen] = useState(false);
  const [anniversary, setAnniversary] = useState(user!.anniversaryDate || "");
  const [anniversaryError, setAnniversaryError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<User>) => apiRequest<User>("PATCH", `/api/users/${user!.id}`, patch),
    onSuccess: (updated) => {
      setUser(updated);
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
    },
  });

  const saveAnniversary = () => {
    setAnniversaryError(null);
    if (!anniversary) {
      updateMutation.mutate({ anniversaryDate: null as any });
      return;
    }
    const year = Number(anniversary.slice(0, 4));
    if (year < 1900 || year > 9999) {
      setAnniversaryError(t("common.error"));
      return;
    }
    updateMutation.mutate({ anniversaryDate: anniversary });
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const ok = await subscribeToPush(user!.id);
      if (!ok) {
        toast({ title: t("common.error"), variant: "destructive" });
        return;
      }
    }
    updateMutation.mutate({ notificationsEnabled: enabled });
  };

  const changeReminderTime = (value: string) => {
    updateMutation.mutate({ reminderTime: value });
    toast({ title: t("profile.timeUpdated") });
  };

  const changeLanguage = (value: "sl" | "en" | "hr") => {
    setLang(value);
    updateMutation.mutate({ language: value });
  };

  const anniversaryDisplay = user!.anniversaryDate
    ? new Date(user!.anniversaryDate).toLocaleDateString("sl-SI", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <h1 className="text-xl font-extrabold">{t("profile.title")}</h1>

      <Card className="bg-together-warm text-white">
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-lg font-extrabold">{user!.name}</p>
            <p className="text-sm text-white/85">{user!.email}</p>
            <div className="mt-1 flex items-center gap-1 text-xs font-bold text-white/90">
              <Heart className={`h-3.5 w-3.5 ${user!.partnerId ? "fill-white" : ""}`} />
              {user!.partnerId ? t("home.connected") : t("home.notConnected")}
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="rounded-full bg-white/25 p-2">
            <Pencil className="h-5 w-5" />
          </button>
        </CardContent>
      </Card>

      {!user!.partnerId && (
        <Link href="/connect">
          <Card className="border-2 border-dashed border-primary/40 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <p className="font-extrabold text-primary">{t("partner.connectTitle")}</p>
              <ChevronRight className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        </Link>
      )}

      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <p className="font-extrabold">{t("profile.anniversary")}</p>
          <div className="flex gap-2">
            <Input type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={saveAnniversary} disabled={updateMutation.isPending}>
              {t("profile.save")}
            </Button>
          </div>
          {anniversaryError && <p className="text-xs font-semibold text-destructive">{anniversaryError}</p>}
          {anniversaryDisplay && <p className="text-sm text-muted-foreground">💕 {anniversaryDisplay}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold">
              <Bell className="h-5 w-5 text-primary" /> {t("profile.notifications")}
            </div>
            <Switch checked={user!.notificationsEnabled} onCheckedChange={toggleNotifications} />
          </div>
          {user!.notificationsEnabled && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t("profile.reminderTime")}</p>
              <Select value={user!.reminderTime} onValueChange={changeReminderTime}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TIMES.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time === "random" ? t("profile.random") : time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 font-extrabold">
            <Globe className="h-5 w-5 text-primary" /> {t("profile.language")}
          </div>
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {(["sl", "en", "hr"] as const).map((l) => (
              <button
                key={l}
                onClick={() => changeLanguage(l)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 font-extrabold">
            {theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
            {t("profile.darkMode")}
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </CardContent>
      </Card>

      {canInstall && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              <div>
                <p className="font-extrabold">{t("profile.installApp")}</p>
                <p className="text-xs text-muted-foreground">{t("profile.installDesc")}</p>
              </div>
            </div>
            <Button size="sm" onClick={install}>
              {t("profile.install")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col divide-y divide-border py-0">
          <Link href="/custom-content" className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 font-bold">
              <Sparkles className="h-5 w-5 text-primary" /> {t("profile.customContent")}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/terms" className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 font-bold">
              <FileText className="h-5 w-5 text-primary" /> {t("profile.terms")}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <a href="mailto:podpora@together.app" className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 font-bold">
              <HelpCircle className="h-5 w-5 text-primary" /> {t("profile.help")}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="mt-2 border-destructive/40 text-destructive hover:bg-destructive/5"
        onClick={() => {
          logout();
          navigate("/");
        }}
      >
        <LogOut className="h-4 w-4" /> {t("profile.logout")}
      </Button>

      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
