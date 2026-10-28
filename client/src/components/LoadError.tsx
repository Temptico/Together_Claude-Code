import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { isNetworkError } from "@/lib/queryClient";

// What a page shows instead of an endless spinner when its data can't be
// loaded: says whether it's the connection or the server, and offers a retry.
export function LoadError({ error, onRetry, className }: { error?: unknown; onRetry: () => void; className?: string }) {
  const { t } = useTranslation();
  const offline = isNetworkError(error);
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl bg-muted px-4 py-8 text-center ${className ?? ""}`}>
      <WifiOff className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-semibold text-muted-foreground">{offline ? t("common.offline") : t("common.loadFailed")}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" /> {t("common.retry")}
      </Button>
    </div>
  );
}
