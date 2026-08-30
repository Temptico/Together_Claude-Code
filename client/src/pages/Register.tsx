import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useState } from "react";

export default function Register() {
  const { t, lang, setLang } = useTranslation();
  const { setUser } = useAuth();
  const [, navigate] = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmPin, setConfirmPin] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InsertUser>({ resolver: zodResolver(insertUserSchema) });

  const onSubmit = async (data: InsertUser) => {
    setServerError(null);
    setConfirmError(null);
    if (data.pin !== confirmPin) {
      setConfirmError(t("auth.pinMismatch"));
      return;
    }
    try {
      const user = await apiRequest<User>("POST", "/api/auth/register", { ...data, language: lang });
      setUser(user);
      // Always show onboarding, even for someone registering via a partner's
      // invite link — it's the only place install instructions are shown,
      // and OnboardingTour's final step already routes to /connect, which
      // still auto-fills any pending invite code from sessionStorage.
      navigate("/onboarding");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setServerError(t("auth.emailInUse"));
      } else {
        setServerError(t("common.error"));
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10 text-white">
      <div className="mb-8 text-center">
        <div className="text-5xl mb-2">💞</div>
        <h1 className="text-2xl font-extrabold">{t("auth.createAccount")}</h1>
        <div className="mt-3 flex justify-center gap-1 rounded-full bg-white/20 p-1 w-fit mx-auto">
          {(["sl", "en", "hr"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                lang === l ? "bg-white text-primary" : "text-white/80"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name" className="text-slate-700">
            {t("auth.name")}
          </Label>
          <Input
            id="name"
            placeholder={t("auth.namePlaceholder")}
            className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
            {...register("name")}
          />
          {errors.name && <p className="text-xs font-semibold text-destructive">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-slate-700">
            {t("auth.email")}
          </Label>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
            {...register("email")}
          />
          {errors.email && <p className="text-xs font-semibold text-destructive">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pin" className="text-slate-700">
            {t("auth.pin")}
          </Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder={t("auth.pinPlaceholder")}
            className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 tracking-[0.3em]"
            {...register("pin")}
          />
          {errors.pin && <p className="text-xs font-semibold text-destructive">{errors.pin.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPin" className="text-slate-700">
            {t("auth.confirmPin")}
          </Label>
          <Input
            id="confirmPin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 tracking-[0.3em]"
          />
          {confirmError && <p className="text-xs font-semibold text-destructive">{confirmError}</p>}
        </div>

        {serverError && <p className="text-sm font-semibold text-destructive">{serverError}</p>}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
          {t("auth.createAccountCta")}
        </Button>

        <Link href="/login" className="text-center text-sm font-semibold text-primary">
          {t("auth.haveAccount")}
        </Link>
      </form>
    </div>
  );
}
