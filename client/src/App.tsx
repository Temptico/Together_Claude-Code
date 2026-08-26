import { lazy, Suspense } from "react";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/i18n/i18n";
import { ToastContextProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { BottomNav } from "@/components/BottomNav";

import Welcome from "@/pages/Welcome";

const Register = lazy(() => import("@/pages/Register"));
const Login = lazy(() => import("@/pages/Login"));
const Home = lazy(() => import("@/pages/Home"));
const ConnectPartner = lazy(() => import("@/pages/ConnectPartner"));
const Invite = lazy(() => import("@/pages/Invite"));
const QuestionAnswer = lazy(() => import("@/pages/QuestionAnswer"));
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
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="app-shell items-center justify-center bg-together-gradient">
        <div className="text-4xl animate-pulse">💗</div>
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
      <div className="content-scroll-pad flex-1 overflow-y-auto">
        <Suspense fallback={<RouteLoading />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/connect" component={ConnectPartner} />
            <Route path="/invite/:code" component={Invite} />
            <Route path="/question" component={QuestionAnswer} />
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
    </div>
  );
}

export default function App() {
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
