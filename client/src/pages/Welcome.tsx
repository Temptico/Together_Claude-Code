import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";

export default function Welcome() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="text-7xl drop-shadow-sm">💞</div>
        <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-sm">{t("appName")}</h1>
        <p className="text-lg font-semibold text-white/90">{t("tagline")}</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 shadow-lg">
          <Link href="/register">{t("auth.createAccount")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="border-white/70 text-white hover:bg-white/10">
          <Link href="/login">{t("auth.login")}</Link>
        </Button>
      </div>
    </div>
  );
}
