import { Route, Switch, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/i18n/i18n";
import { ToastContextProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { BottomNav } from "@/components/BottomNav";

import Welcome from "@/pages/Welcome";
import Register from "@/pages/Register";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import ConnectPartner from "@/pages/ConnectPartner";
import Invite from "@/pages/Invite";
import QuestionAnswer from "@/pages/QuestionAnswer";
import Dates from "@/pages/Dates";
import Memories from "@/pages/Memories";
import Profile from "@/pages/Profile";
import Terms from "@/pages/Terms";
import CustomContent from "@/pages/CustomContent";
import NotFound from "@/pages/NotFound";

function Shell() {
  const { user, isLoading } = useAuth();

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
        <Switch>
          <Route path="/register" component={Register} />
          <Route path="/login" component={Login} />
          <Route path="/invite/:code" component={Invite} />
          <Route component={Welcome} />
        </Switch>
      </div>
    );
  }

  return (
    <div className="app-shell bg-background safe-top">
      <div className="flex-1 overflow-y-auto pb-24">
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
