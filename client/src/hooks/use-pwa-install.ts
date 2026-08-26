import { useEffect, useState } from "react";

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

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos] = useState(isIosDevice);
  const [isAndroid] = useState(isAndroidDevice);
  const [isStandalone] = useState(isStandaloneDisplay);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

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
