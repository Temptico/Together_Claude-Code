import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { cn } from "@/lib/utils";

const STEPS = [
  { emoji: "🥰", key: "mood" },
  { emoji: "💬", key: "question" },
  { emoji: "🏆", key: "challenge" },
  { emoji: "💌", key: "connect" },
] as const;

export default function OnboardingTour() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = (goTo: string) => {
    localStorage.setItem("together:onboardingDone", "1");
    navigate(goTo);
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
        <h1 className="text-2xl font-extrabold">{t(`onboarding.${current.key}Title`)}</h1>
        <p className="max-w-xs text-white/90">{t(`onboarding.${current.key}Body`)}</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-white" : "w-1.5 bg-white/40")}
            />
          ))}
        </div>

        {isLast ? (
          <Button size="lg" className="w-full bg-white text-primary hover:bg-white/90" onClick={() => finish("/connect")}>
            {t("onboarding.connectCta")}
          </Button>
        ) : (
          <Button size="lg" className="w-full bg-white text-primary hover:bg-white/90" onClick={() => setStep((s) => s + 1)}>
            {t("onboarding.next")}
          </Button>
        )}
      </div>
    </div>
  );
}
