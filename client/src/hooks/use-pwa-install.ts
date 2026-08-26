import { useEffect, useState } from "react";

// iOS Safari has no `beforeinstallprompt` API at all — there's no
// programmatic way to trigger the install flow there, only the manual
// Share → Add to Home Screen path, so callers need to know to show
// instructions instead of a button.
function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneDisplay(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos] = useState(isIosDevice);
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

  return {
    canInstall: !!prompt && !installed,
    install,
    showIosInstructions: isIos && !isStandalone,
  };
}
