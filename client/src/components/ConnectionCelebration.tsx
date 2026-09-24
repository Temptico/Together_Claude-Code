import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { isNewConnection, recordPartnerState, finishCelebration } from "@/lib/celebration";

// Full-screen "you're connected!" moment, shown once on each partner's
// device — right after entering the code, and on the other phone when its
// session picks up the new connection.
export function ConnectionCelebration() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (isNewConnection(user.partnerId)) setOpen(true);
    else recordPartnerState(user.partnerId);
  }, [user?.id, user?.partnerId]);

  const { data } = useQuery<{ partner?: { name: string } | null }>({
    queryKey: ["/api/home", user?.id],
    enabled: open && !!user,
  });

  if (!open) return null;

  const close = () => {
    finishCelebration(user?.partnerId);
    setOpen(false);
    navigate("/");
  };

  const partnerName = data?.partner?.name || t("memories.partner");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <Confetti />
      <div className="relative z-[62] w-full max-w-sm rounded-3xl bg-together-warm p-6 text-center text-white shadow-2xl">
        <div className="text-6xl">💞</div>
        <h2 id="celebration-title" className="mt-3 text-2xl font-extrabold">
          {t("celebration.title")}
        </h2>
        <p className="mt-2 text-white/90">{t("celebration.body").replace("{name}", partnerName)}</p>
        <Button size="lg" autoFocus className="mt-6 w-full bg-white text-primary hover:bg-white/90" onClick={close}>
          {t("celebration.cta")}
        </Button>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["#ff6b6b", "#ffa94d", "#ffd166", "#ef476f", "#ffffff"];
const CONFETTI_MS = 4000;

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.6,
      w: (6 + Math.random() * 6) * dpr,
      h: (8 + Math.random() * 8) * dpr,
      vx: (Math.random() - 0.5) * 2 * dpr,
      vy: (2 + Math.random() * 3) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));

    const start = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Fade out over the last second instead of pieces vanishing mid-air.
      ctx.globalAlpha = Math.min(1, Math.max(0, (CONFETTI_MS - elapsed) / 1000));
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < CONFETTI_MS) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[61] h-full w-full" />;
}
