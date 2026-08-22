import { Link, useLocation } from "wouter";
import { Home, CalendarHeart, Sparkles, User } from "lucide-react";
import { useTranslation } from "@/i18n/i18n";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const items = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/dates", label: t("nav.dates"), icon: CalendarHeart },
    { href: "/memories", label: t("nav.memories"), icon: Sparkles },
    { href: "/profile", label: t("nav.profile"), icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-bold transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-6 w-6", active && "fill-primary/15")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
