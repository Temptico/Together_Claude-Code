import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Home, CalendarHeart, Sparkles, User } from "lucide-react";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const LAST_SEEN_KEY = "together:lastSeenPartnerMoodId";

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Shares the same query the Home page uses, so this doesn't cause an
  // extra network request — just reads whatever's already cached/polling.
  const { data } = useQuery<{ partnerMood: { id: number } | null }>({
    queryKey: ["/api/home", user?.id],
    enabled: !!user,
  });

  // Re-render when Home marks a mood as seen, so the badge clears right
  // away instead of waiting for the next poll.
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1);
    window.addEventListener("together:partnerMoodSeen", handler);
    return () => window.removeEventListener("together:partnerMoodSeen", handler);
  }, []);

  const lastSeenId = typeof window !== "undefined" ? localStorage.getItem(LAST_SEEN_KEY) : null;
  const hasUnseenPartnerActivity = !!data?.partnerMood && String(data.partnerMood.id) !== lastSeenId;

  const items = [
    { href: "/", label: t("nav.home"), icon: Home, badge: hasUnseenPartnerActivity },
    { href: "/dates", label: t("nav.dates"), icon: CalendarHeart, badge: false },
    { href: "/memories", label: t("nav.memories"), icon: Sparkles, badge: false },
    { href: "/profile", label: t("nav.profile"), icon: User, badge: false },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-bold transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <Icon className={cn("h-6 w-6", active && "fill-primary/15")} />
                {badge && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
