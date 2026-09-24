import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "./queryClient";
import type { User } from "@shared/schema";

const STORAGE_KEY = "together:userId";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const { data, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/session", userId],
    queryFn: async () => {
      try {
        return await apiRequest<User>("GET", `/api/auth/session/${userId}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          setUserId(null);
        }
        throw err;
      }
    },
    enabled: !!userId,
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
    qc.setQueryData(["/api/auth/session", u.id], u);
    setUserId(u.id);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ user: data ?? null, isLoading: !!userId && isLoading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
