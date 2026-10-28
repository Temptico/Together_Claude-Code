import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "./queryClient";
import type { User } from "@shared/schema";

const STORAGE_KEY = "together:userId";
// The last known user, so opening the app offline (or during a server
// hiccup) keeps showing the logged-in app instead of the Welcome screen as
// if they had been logged out.
const USER_CACHE_KEY = "together:userCache";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  // The session couldn't be loaded and there is no cached user to fall
  // back on (first open offline, server down).
  isUnavailable: boolean;
  error: unknown;
  retry: () => void;
  setUser: (user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedUser(id: string | null): User | undefined {
  if (!id) return undefined;
  try {
    const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "null");
    return cached && cached.id === id ? cached : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Not caching is fine.
  }
}

// Best-effort: stop this device's push subscription so a shared phone
// doesn't keep showing the previous account's partner notifications.
async function unsubscribePush() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return;
    await apiRequest("POST", "/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    // Nothing to clean up.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const { data, isLoading, isError, error, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/session", userId],
    queryFn: async () => {
      try {
        const user = await apiRequest<User>("GET", `/api/auth/session/${userId}`);
        writeCachedUser(user);
        return user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          writeCachedUser(null);
          setUserId(null);
        }
        throw err;
      }
    },
    enabled: !!userId,
    // Start from the cached copy (treated as stale, so it refetches at once)
    // — on failure the cached user simply stays.
    initialData: () => readCachedUser(userId) ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 15_000,
    // Polls only while not yet connected, so a partner connecting from their
    // own phone shows up here on its own. Once connected, profile changes are
    // rare and refetchOnWindowFocus covers them — every poll wakes the Neon
    // database, so there's no point polling a status that won't change.
    refetchInterval: (query) => (query.state.data?.partnerId ? false : 20_000),
    refetchOnWindowFocus: true,
    retry: false,
  });

  const setUser = (u: User) => {
    localStorage.setItem(STORAGE_KEY, u.id);
    writeCachedUser(u);
    qc.setQueryData(["/api/auth/session", u.id], u);
    setUserId(u.id);
  };

  const logout = () => {
    void unsubscribePush();
    localStorage.removeItem(STORAGE_KEY);
    writeCachedUser(null);
    setUserId(null);
  };

  const user = data ?? null;
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: !!userId && isLoading,
        isUnavailable: !!userId && isError && !user,
        error,
        retry: () => void refetch(),
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
