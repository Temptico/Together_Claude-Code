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
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [, navigate] = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InsertUser>({ resolver: zodResolver(insertUserSchema) });

  const onSubmit = async (data: InsertUser) => {
    setServerError(null);
    try {
      const user = await apiRequest<User>("POST", "/api/auth/register", data);
      setUser(user);
      navigate(sessionStorage.getItem("together:pendingInviteCode") ? "/connect" : "/");
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
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 rounded-3xl bg-white/95 p-6 text-foreground shadow-xl"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t("auth.name")}</Label>
          <Input id="name" placeholder={t("auth.namePlaceholder")} {...register("name")} />
          {errors.name && <p className="text-xs font-semibold text-destructive">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" placeholder={t("auth.emailPlaceholder")} {...register("email")} />
          {errors.email && <p className="text-xs font-semibold text-destructive">{errors.email.message}</p>}
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
