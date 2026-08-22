import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DRAFT_KEY_PREFIX = "together:draft:";

export default function QuestionAnswer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [answer, setAnswer] = useState("");

  const { data } = useQuery<any>({ queryKey: ["/api/home", user!.id] });
  const question = data?.question;
  const myAnswer = data?.myAnswer;

  const draftKey = question ? `${DRAFT_KEY_PREFIX}${question.id}` : null;

  useEffect(() => {
    if (draftKey && !myAnswer) {
      const draft = localStorage.getItem(draftKey);
      if (draft) setAnswer(draft);
    }
  }, [draftKey, myAnswer]);

  const saveDraft = () => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, answer);
    toast({ title: t("question.saveDraft") + " ✓" });
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/question/answer", { userId: user!.id, questionId: question.id, answer }),
    onSuccess: () => {
      if (draftKey) localStorage.removeItem(draftKey);
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      qc.invalidateQueries({ queryKey: ["/api/memories", user!.id] });
      toast({ title: t("question.sent") });
      navigate("/");
    },
  });

  if (!question) {
    return <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <button onClick={() => navigate("/")} className="flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <Card className="bg-together-warm text-white">
        <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
          <MessageCircle className="h-8 w-8" />
          <p className="text-xs font-bold uppercase tracking-wide text-white/80">{t("question.title")}</p>
          <p className="text-lg font-extrabold">{question.text}</p>
        </CardContent>
      </Card>

      {myAnswer ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-bold text-muted-foreground">{t("home.alreadyAnswered")}</p>
            <p className="mt-1 text-sm">{myAnswer.answer}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t("question.placeholder")}
            rows={6}
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={saveDraft} disabled={!answer.trim()}>
              {t("question.saveDraft")}
            </Button>
            <Button
              className="flex-1"
              disabled={!answer.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? t("question.sending") : t("question.send")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
