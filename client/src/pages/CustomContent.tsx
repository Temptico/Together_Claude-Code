import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, ApiError } from "@/lib/queryClient";

export default function CustomContent() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <button
        onClick={() => navigate("/profile")}
        className="flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <h1 className="text-xl font-extrabold">{t("custom.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("custom.hint")}</p>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">{t("custom.questionsTab")}</TabsTrigger>
          <TabsTrigger value="challenges">{t("custom.challengesTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="mt-4">
          <CustomList kind="question" />
        </TabsContent>
        <TabsContent value="challenges" className="mt-4">
          <CustomList kind="challenge" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomList({ kind }: { kind: "question" | "challenge" }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const endpoint = kind === "question" ? "/api/custom-questions" : "/api/custom-challenges";
  const queryKey = [endpoint, user!.id];

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey,
    queryFn: () => apiRequest("GET", `${endpoint}/${user!.id}`),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", endpoint, { userId: user!.id, text }),
    onSuccess: () => {
      setText("");
      setError(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("common.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `${endpoint}/${id}?userId=${user!.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const placeholder = kind === "question" ? t("custom.questionPlaceholder") : t("custom.challengePlaceholder");
  const emptyMsg = kind === "question" ? t("custom.empty") : t("custom.emptyChallenges");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={3} />
          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
          <Button
            size="sm"
            className="self-start"
            disabled={text.trim().length < 3 || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Plus className="h-4 w-4" /> {t("custom.add")}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMsg}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <p className="flex-1 text-sm">{item.text}</p>
                <Badge variant={item.used ? "secondary" : "default"}>
                  {item.used ? t("custom.used") : t("custom.pending")}
                </Badge>
                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t("dates.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
