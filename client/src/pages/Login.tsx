import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { requestLoginCodeSchema, verifyLoginCodeSchema, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useState } from "react";

type EmailData = z.infer<typeof requestLoginCodeSchema>;
type CodeData = z.infer<typeof verifyLoginCodeSchema>;

// Passwordless login: request a one-time code by email, then enter it.
// Existing sessions (userId already in this device's localStorage) never hit
// this page at all — see auth.tsx — so this only affects a fresh login.
export default function Login() {
  const { t, setLang } = useTranslation();
  const { setUser } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailForm = useForm<EmailData>({ resolver: zodResolver(requestLoginCodeSchema) });
  const codeForm = useForm<CodeData>({ resolver: zodResolver(verifyLoginCodeSchema) });

  const goAfterLogin = (user: User) => {
    setUser(user);
    // The display language otherwise lives purely in this device's
    // localStorage — on a fresh device/session it falls back to browser
    // locale detection, silently ignoring the language the account was
    // actually set to. Syncing it here is what makes the choice actually
    // follow the account across sessions/devices.
    if (user.language === "sl" || user.language === "en" || user.language === "hr") setLang(user.language);
    navigate(sessionStorage.getItem("together:pendingInviteCode") ? "/connect" : "/");
  };

  const requestCode = async (data: EmailData) => {
    setServerError(null);
    setNotice(null);
    try {
      await apiRequest("POST", "/api/auth/login/request-code", data);
      setEmail(data.email);
      codeForm.setValue("email", data.email);
      codeForm.setValue("code", "");
      setStep("code");
      setNotice(t("auth.codeSent"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setServerError(t("auth.notFound"));
      } else if (err instanceof ApiError && err.status === 429) {
        setServerError(err.message);
      } else {
        setServerError(t("common.error"));
      }
    }
  };

  const verifyCode = async (data: CodeData) => {
    setServerError(null);
    try {
      const user = await apiRequest<User>("POST", "/api/auth/login/verify-code", data);
      goAfterLogin(user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setServerError(t("auth.wrongCode"));
      } else if (err instanceof ApiError && err.status === 429) {
        setServerError(err.message);
      } else {
        setServerError(t("common.error"));
      }
    }
  };

  const resend = async () => {
    setServerError(null);
    setNotice(null);
    try {
      await apiRequest("POST", "/api/auth/login/request-code", { email });
      setNotice(t("auth.codeSent"));
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10 text-white">
      <div className="mb-8 text-center">
        <div className="text-5xl mb-2">💞</div>
        <h1 className="text-2xl font-extrabold">{t("auth.login")}</h1>
      </div>

      {step === "email" ? (
        <form
          onSubmit={emailForm.handleSubmit(requestCode)}
          className="flex flex-col gap-4 rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-slate-700">
              {t("auth.email")}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email && (
              <p className="text-xs font-semibold text-destructive">{emailForm.formState.errors.email.message}</p>
            )}
            <p className="text-xs text-slate-500">{t("auth.codeExplain")}</p>
          </div>

          {serverError && <p className="text-sm font-semibold text-destructive">{serverError}</p>}

          <Button type="submit" size="lg" disabled={emailForm.formState.isSubmitting} className="mt-2">
            {t("auth.sendCodeCta")}
          </Button>

          <Link href="/register" className="text-center text-sm font-semibold text-primary">
            {t("auth.noAccount")}
          </Link>
        </form>
      ) : (
        <form
          onSubmit={codeForm.handleSubmit(verifyCode)}
          className="flex flex-col gap-4 rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code" className="text-slate-700">
              {t("auth.code")}
            </Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder={t("auth.codePlaceholder")}
              className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 tracking-[0.3em] text-center text-lg"
              {...codeForm.register("code")}
            />
            {codeForm.formState.errors.code && (
              <p className="text-xs font-semibold text-destructive">{codeForm.formState.errors.code.message}</p>
            )}
            <p className="text-xs text-slate-500">{t("auth.codeSentTo")} {email}</p>
          </div>

          {notice && !serverError && <p className="text-sm font-semibold text-primary">{notice}</p>}
          {serverError && <p className="text-sm font-semibold text-destructive">{serverError}</p>}

          <Button type="submit" size="lg" disabled={codeForm.formState.isSubmitting} className="mt-2">
            {t("auth.loginCta")}
          </Button>

          <div className="flex items-center justify-between text-sm font-semibold">
            <button type="button" onClick={() => setStep("email")} className="text-slate-500">
              {t("auth.changeEmail")}
            </button>
            <button type="button" onClick={resend} className="text-primary">
              {t("auth.resendCode")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
