import { useLocation } from "wouter";

// "Back" that behaves like the browser/Android back button: returns to the
// previous screen when there is one in history, otherwise goes to a sensible
// fallback (e.g. a page opened straight from a notification or a link).
export function useBack(fallback = "/") {
  const [, navigate] = useLocation();
  return () => {
    if (window.history.length > 1) window.history.back();
    else navigate(fallback);
  };
}
