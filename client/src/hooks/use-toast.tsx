import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

type ToastInput = Omit<ToastItem, "id">;

type ToastContextValue = {
  toasts: ToastItem[];
  toast: (t: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Lets non-React code (the query client's global error handler) show a
// toast: the provider below subscribes while mounted.
const listeners = new Set<(t: ToastInput) => void>();
export function emitToast(t: ToastInput) {
  for (const l of listeners) l(t);
}

export function ToastContextProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = (t: ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  };

  useEffect(() => {
    listeners.add(toast);
    return () => {
      listeners.delete(toast);
    };
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id));

  return <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastContextProvider");
  return ctx;
}
