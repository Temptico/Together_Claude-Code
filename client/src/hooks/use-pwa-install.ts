import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

// iOS Safari has no `beforeinstallprompt` API at all — there's no
// programmatic way to trigger the install flow there, only the manual
// Share → Add to Home Screen path. Some Android browsers (and Chrome after
// a prompt was already dismissed once) don't fire it either, so "no native
// prompt" isn't reliably Android-vs-iOS — callers need explicit OS-aware
// manual instructions as the fallback either way.
function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroidDevice(): boolean {
  return /android/i.test(navigator.userAgent);
}

function isStandaloneDisplay(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

// Once-per-browser guard so an already-installed user (standalone mode is
// true on every single launch) doesn't PATCH the server on every app open —
// the server-side write is idempotent either way, this just avoids the noise.
const RECORDED_KEY = "together:pwaInstallRecorded";

export function usePwaInstall() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos] = useState(isIosDevice);
  const [isAndroid] = useState(isAndroidDevice);
  const [isStandalone] = useState(isStandaloneDisplay);

  const recordInstalled = () => {
    if (!user) return;
    try {
      if (localStorage.getItem(RECORDED_KEY)) return;
    } catch {
      /* localStorage unavailable — fine to just skip the once-per-browser guard */
    }
    apiRequest("PATCH", `/api/users/${user.id}`, { pwaInstalled: true })
      .then(() => {
        try {
          localStorage.setItem(RECORDED_KEY, "1");
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* best-effort — a missed beat just means the admin count is briefly
           behind, not worth surfacing to the user */
      });
  };

  // Catches iOS (no appinstalled event exists there — standalone mode on
  // launch is the only signal) and retroactively catches anyone who
  // installed before this tracking shipped, on their next open.
  useEffect(() => {
    if (isStandalone) recordInstalled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone, user?.id]);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      recordInstalled();
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  const canInstall = !!prompt && !installed;
  // One combined "how to install" card: a native button when the browser
  // offers one, otherwise manual steps worded for whichever OS this is.
  const showInstallCard = !isStandalone && !installed && (canInstall || isIos || isAndroid);
  const instructionsKey = isIos ? "profile.installIosDesc" : "profile.installAndroidDesc";

  return { canInstall, install, showInstallCard, instructionsKey };
}
