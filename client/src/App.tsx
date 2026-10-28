import { lazy, Suspense, useEffect, useRef } from "react";
import { LoadError } from "@/components/LoadError";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/i18n/i18n";
import { ToastContextProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { BottomNav } from "@/components/BottomNav";
import { InstallReminderDialog } from "@/components/InstallReminderDialog";
import { ConnectionCelebration } from "@/components/ConnectionCelebration";
import { trackLandingVisit } from "@/lib/acquisition";

import Welcome from "@/pages/Welcome";

const Register = lazy(() => import("@/pages/Register"));
const Login = lazy(() => import("@/pages/Login"));
const Home = lazy(() => import("@/pages/Home"));
const ConnectPartner = lazy(() => import("@/pages/ConnectPartner"));
const Invite = lazy(() => import("@/pages/Invite"));
const QuestionAnswer = lazy(() => import("@/pages/QuestionAnswer"));
const GamePlay = lazy(() => import("@/pages/GamePlay"));
const Dates = lazy(() => import("@/pages/Dates"));
const Memories = lazy(() => import("@/pages/Memories"));
const Profile = lazy(() => import("@/pages/Profile"));
const Terms = lazy(() => import("@/pages/Terms"));
const CustomContent = lazy(() => import("@/pages/CustomContent"));
const OnboardingTour = lazy(() => import("@/pages/OnboardingTour"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24 text-3xl animate-pulse">💗</div>
  );
}

function Shell() {
  const { user, isLoading, isUnavailable, error, retry } = useAuth();
  const [location] = useLocation();
  const scroller = useRef<HTMLDivElement>(null);

  // A new page opens at its top, not wherever the previous one was scrolled.
  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [location]);

  if (isLoading) {
    return (
      <div className="app-shell items-center justify-center bg-together-gradient">
        <div className="text-4xl animate-pulse">💗</div>
      </div>
    );
  }

  // Logged in on this device, but the session can't be loaded and nothing
  // is cached (first open while offline, or the server is down): say so
  // instead of showing the logged-out Welcome screen.
  if (isUnavailable) {
    return (
      <div className="app-shell items-center justify-center bg-together-gradient px-6 safe-top safe-bottom">
        <LoadError error={error} onRetry={retry} className="w-full max-w-sm bg-white/80" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell bg-together-gradient safe-top safe-bottom">
        <Suspense fallback={<RouteLoading />}>
          <Switch>
            <Route path="/register" component={Register} />
            <Route path="/login" component={Login} />
            <Route path="/invite/:code" component={Invite} />
            <Route component={Welcome} />
          </Switch>
        </Suspense>
      </div>
    );
  }

  if (location === "/onboarding") {
    return (
      <div className="app-shell bg-together-gradient safe-top safe-bottom">
        <Suspense fallback={<RouteLoading />}>
          <OnboardingTour />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app-shell bg-background safe-top">
      <div ref={scroller} className="content-scroll-pad flex-1 overflow-y-auto">
        <Suspense fallback={<RouteLoading />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/connect" component={ConnectPartner} />
            <Route path="/invite/:code" component={Invite} />
            <Route path="/question" component={QuestionAnswer} />
            <Route path="/games/:slug" component={GamePlay} />
            <Route path="/dates" component={Dates} />
            <Route path="/memories" component={Memories} />
            <Route path="/profile" component={Profile} />
            <Route path="/terms" component={Terms} />
            <Route path="/custom-content" component={CustomContent} />
            <Route path="/register">
              <Redirect to="/" />
            </Route>
            <Route path="/login">
              <Redirect to="/" />
            </Route>
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </div>
      <BottomNav />
      <InstallReminderDialog />
      <ConnectionCelebration />
    </div>
  );
}

export default function App() {
  // Runs once per real page load (this component only mounts once), which
  // is exactly what "one landing visit" means here — not once per in-app
  // route change.
  useEffect(() => {
    trackLandingVisit();
  }, []);

  // After a deploy, a tab that was open before it still points at the old
  // content-hashed chunks; opening a not-yet-visited page then 404s. Reload
  // once to pick up the new build instead of showing the error screen.
  useEffect(() => {
    const onPreloadError = (e: Event) => {
      e.preventDefault();
      const key = "together:reloadedForPreloadError";
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // No sessionStorage — still worth one reload attempt.
      }
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <ToastContextProvider>
            <AuthProvider>
              <Shell />
            </AuthProvider>
            <Toaster />
          </ToastContextProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
