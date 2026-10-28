import { MutationCache, QueryClient } from "@tanstack/react-query";
import { emitToast } from "@/hooks/use-toast";
import { translate } from "@/i18n/i18n";
import { errorCodeFor } from "@shared/errorCodes";

export class ApiError extends Error {
  status: number;
  // Stable code the server attaches to known messages (shared/errorCodes.ts).
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// fetch() rejects (rather than returning a response) when there's no
// network at all — offline, DNS failure, server unreachable.
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && err.name === "AbortError");
}

// A server/zod message in the UI language. The server authors messages in
// Slovenian and attaches a code; messages produced client-side by the
// shared zod schemas carry no code, so those are looked up by text.
export function localizeMessage(message: string | undefined, code?: string): string {
  if (!message) return translate("common.error");
  const key = `errors.${code ?? errorCodeFor(message) ?? ""}`;
  const translated = translate(key);
  return translated === key ? message : translated;
}

export async function apiRequest<T = any>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error || translate("common.error"), data?.code);
  }
  return data as T;
}

// Text to show for a failed request: the server's own reason when it gave
// one (a 4xx), in the user's language where known; otherwise a generic or
// offline message.
export function errorText(err: unknown): string {
  if (isNetworkError(err)) return translate("common.offline");
  if (err instanceof ApiError && err.status < 500) return localizeMessage(err.message, err.code);
  return translate("common.error");
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => apiRequest("GET", queryKey.join("/")),
      staleTime: 30_000,
      retry: false,
    },
  },
  // A tap that fails (offline, server error) used to do nothing at all in
  // most places. Any mutation without its own onError now surfaces a toast.
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      emitToast({ title: errorText(err), variant: "destructive" });
    },
  }),
});
