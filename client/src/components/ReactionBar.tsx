import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { REACTION_EMOJIS } from "@shared/schema";
import { cn } from "@/lib/utils";

type ReactionItem = { userId: string; emoji: string };

export function ReactionBar({
  targetType,
  targetId,
  reactions,
  invalidateKeys,
}: {
  targetType: "mood" | "answer" | "challenge";
  targetId: number;
  reactions: ReactionItem[];
  invalidateKeys: unknown[][];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const myReaction = reactions.find((r) => r.userId === user!.id);

  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const mutation = useMutation({
    mutationFn: (emoji: string) =>
      apiRequest("POST", "/api/reactions", { userId: user!.id, targetType, targetId, emoji }),
    onSuccess: () => {
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
      setPickerOpen(false);
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.entries(grouped).map(([emoji, count]) => (
        <button
          key={emoji}
          onClick={() => mutation.mutate(emoji)}
          disabled={mutation.isPending}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold",
            myReaction?.emoji === emoji ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
          )}
        >
          <span>{emoji}</span>
          {count > 1 && <span>{count}</span>}
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground"
        >
          +
        </button>
        {pickerOpen && (
          <div className="absolute bottom-8 left-0 z-10 flex gap-1 rounded-full border border-border bg-card p-1.5 shadow-lg">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => mutation.mutate(emoji)}
                disabled={mutation.isPending}
                className="flex h-7 w-7 items-center justify-center rounded-full text-lg hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
