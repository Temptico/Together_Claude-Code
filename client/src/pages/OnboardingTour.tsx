import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { subscribeToPush } from "@/hooks/use-push";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";

const FEATURE_STEPS = [
  { emoji: "🥰", key: "mood" },
  { emoji: "💬", key: "question" },
  { emoji: "🏆", key: "challenge" },
] as const;

const BIRTHDAY_STEP = { emoji: "🎂", key: "birthday" } as const;
const NOTIFICATIONS_STEP = { emoji: "🔔", key: "notifications" } as const;
const CONNECT_STEP = { emoji: "💌", key: "connect" } as const;
const INSTALL_STEP = { emoji: "📲", key: "install" } as const;

export default function OnboardingTour() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [birthdayInput, setBirthdayInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { showInstallCard, canInstall, install, instructionsKey } = usePwaInstall();

  // Decided once, on entry: answering these steps changes the very state
  // they're gated on (a saved birthday, a granted permission), and dropping
  // a step mid-tour would shift every later step's index.
  const [askBirthday] = useState(() => !user?.birthday);
  const [askNotifications] = useState(() => "Notification" in window && Notification.permission === "default");

  // The install step only makes sense where installing is actually possible
  // (skipped entirely if already installed, or on a desktop browser with no
  // relevant install path) — this is the same gate Profile's install card uses.
  // The connect step only makes sense before pairing has happened — an
  // already-connected user replaying this from Profile's "Quick app tour"
  // doesn't need to be pushed back through partner-connect, so install
  // becomes the genuine final slide for them instead.
  const steps = useMemo(() => {
    const s: Array<{ emoji: string; key: string }> = [...FEATURE_STEPS];
    if (askBirthday) s.push(BIRTHDAY_STEP);
    if (askNotifications) s.push(NOTIFICATIONS_STEP);
    if (showInstallCard) s.push(INSTALL_STEP);
    if (!user?.partnerId) s.push(CONNECT_STEP);
    return s;
  }, [askBirthday, askNotifications, showInstallCard, user?.partnerId]);

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const isInstallStep = current.key === "install";
  const isConnectStep = current.key === "connect";
  const isBirthdayStep = current.key === "birthday";
  const isNotificationsStep = current.key === "notifications";

  const finish = (goTo: string) => {
    localStorage.setItem("together:onboardingDone", "1");
    navigate(goTo);
  };

  const next = () => {
    if (isLast) finish(isConnectStep ? "/connect" : "/");
    else setStep((s) => s + 1);
  };

  const advance = async () => {
    setBusy(true);
    try {
      if (isInstallStep && canInstall) await install();
      if (isBirthdayStep && birthdayInput) {
        setUser(await apiRequest<User>("PATCH", `/api/users/${user!.id}`, { birthday: birthdayInput }));
      }
      // Ask for permission only on this explicit tap — a prompt out of
      // nowhere gets reflexively denied, and a denial can't be asked again.
      if (isNotificationsStep && (await subscribeToPush(user!.id))) {
        setUser(await apiRequest<User>("PATCH", `/api/users/${user!.id}`, { notificationsEnabled: true }));
      }
    } catch {
      // A failed save/permission shouldn't trap anyone in the tour — both can
      // be set later from Profile.
    } finally {
      setBusy(false);
    }
    next();
  };

  return (
    <div className="flex flex-1 flex-col justify-between px-8 py-10 text-white">
      <button
        onClick={() => finish("/")}
        className="self-end text-sm font-semibold text-white/80"
      >
        {t("onboarding.skip")}
      </button>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="text-7xl">{current.emoji}</div>
        {isInstallStep ? (
          <>
            <h1 className="text-2xl font-extrabold">{t("profile.installApp")}</h1>
            <p className="max-w-xs text-white/90">{canInstall ? t("profile.installDesc") : t(instructionsKey)}</p>
            <p className="max-w-xs text-xs text-white/70">{t("onboarding.installHint")}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold">{t(`onboarding.${current.key}Title`)}</h1>
            <p className="max-w-xs text-white/90">{t(`onboarding.${current.key}Body`)}</p>
            {isBirthdayStep && (
              <input
                type="date"
                aria-label={t("onboarding.birthdayTitle")}
                value={birthdayInput}
                onChange={(e) => setBirthdayInput(e.target.value)}
                className="mt-2 w-full max-w-xs rounded-2xl border-0 bg-white/20 px-4 py-3 text-center text-base font-bold text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-white"
              />
            )}
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-white" : "w-1.5 bg-white/40")}
            />
          ))}
        </div>

        <Button size="lg" className="w-full bg-white text-primary hover:bg-white/90" onClick={advance} disabled={busy}>
          {isNotificationsStep
            ? t("onboarding.notificationsCta")
            : isLast
              ? isConnectStep
                ? t("onboarding.connectCta")
                : t("onboarding.done")
              : isInstallStep && canInstall
                ? t("profile.install")
                : t("onboarding.next")}
        </Button>
        {isNotificationsStep && (
          <button onClick={next} className="-mt-2 text-sm font-semibold text-white/80">
            {t("home.notifPromptLater")}
          </button>
        )}
      </div>
    </div>
  );
}
