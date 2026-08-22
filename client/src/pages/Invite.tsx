import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";

const PENDING_CODE_KEY = "together:pendingInviteCode";

export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    apiRequest<{ name: string }>("GET", `/api/partner/invite-info/${code}`)
      .then((info) => setInviterName(info.name))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
  }, [code]);

  const handleJoin = () => {
    if (code) sessionStorage.setItem(PENDING_CODE_KEY, code.toUpperCase());
    navigate(user ? "/connect" : "/register");
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center text-white">
      <div className="text-6xl">💌</div>
      {notFound ? (
        <p className="text-lg font-semibold">{t("common.error")}</p>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold">
            {inviterName ? `${inviterName} ${t("partner.inviteTitle")}` : t("appName")}
          </h1>
          <p className="text-white/90">{t("partner.inviteDesc")}</p>
          <Button size="lg" className="bg-white text-primary hover:bg-white/90" onClick={handleJoin}>
            {t("partner.joinNow")}
          </Button>
        </>
      )}
      {!user && (
        <Link href="/" className="text-sm font-semibold text-white/80 underline">
          {t("appName")}
        </Link>
      )}
    </div>
  );
}

export { PENDING_CODE_KEY };
