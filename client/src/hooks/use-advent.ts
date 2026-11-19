import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n/i18n";
import { apiRequest } from "@/lib/queryClient";

export type AdventDay = {
  day: number;
  type: "task" | "question" | "temptico";
  open: boolean;
  completed: boolean;
  title?: string;
  text?: string;
  offerUrl?: string | null;
  gift?: { code: string; note: string | null } | null;
};

export type AdventState = {
  year: number;
  phase: "off" | "invite" | "active" | "catchup";
  today: number;
  joined: boolean;
  goal: number;
  completedCount: number;
  needsConsent: boolean;
  reward: { code: string } | null;
  days: AdventDay[];
};

export function adventQueryKey(userId: string, lang: string) {
  return ["/api/advent", userId, lang];
}

export function useAdvent() {
  const { user } = useAuth();
  const { lang } = useTranslation();
  return useQuery<AdventState>({
    queryKey: adventQueryKey(user?.id ?? "", lang),
    queryFn: () => apiRequest<AdventState>("GET", `/api/advent/${user!.id}?lang=${lang}`),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}

// "{n}" style placeholders in translated strings.
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
}
