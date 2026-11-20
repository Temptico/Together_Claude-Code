import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareStoryButton } from "@/components/ShareStoryButton";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { fill, type AdventFinale } from "@/hooks/use-advent";

// The keepsake once the last door is open: the days the couple did together
// and every note they hid for each other. "Save as PDF" uses the browser's
// print dialog, which on phones offers saving or sharing a PDF.
export default function AdventFinalePage() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery<AdventFinale>({
    queryKey: ["/api/advent", user?.id ?? "", "finale", lang],
    queryFn: () => apiRequest<AdventFinale>("GET", `/api/advent/${user!.id}/finale?lang=${lang}`),
    enabled: !!user,
    retry: false,
  });

  return (
    <div className="advent-finale mx-auto flex max-w-md flex-col gap-5 px-5 py-6">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> {t("advent.finaleBack")}
          </Link>
        </Button>
        {data && (
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Download className="mr-1 h-4 w-4" /> {t("advent.finaleSave")}
          </Button>
        )}
      </div>
      <div className="flex justify-center print:hidden">
        {data && (
          <ShareStoryButton
            variant="default"
            card={{
              emoji: "🎄",
              kicker: fill(t("advent.finaleTitle"), { year: data.year }),
              title: data.names.filter(Boolean).join(" ❤️ "),
              big: `${data.completedCount}/${data.days.length}`,
              subtitle: t("share.finaleSub"),
            }}
          />
        )}
      </div>

      {isLoading && <p className="text-center text-muted-foreground">{t("common.loading")}</p>}
      {isError && <p className="text-center text-muted-foreground">{t("advent.finaleMissing")}</p>}

      {data && (
        <>
          <header className="flex flex-col items-center gap-1 text-center">
            <span className="text-5xl">🎄</span>
            <h1 className="text-2xl font-extrabold">{fill(t("advent.finaleTitle"), { year: data.year })}</h1>
            <p className="font-semibold text-muted-foreground">{data.names.filter(Boolean).join(" ❤️ ")}</p>
            <p className="mt-2 text-lg font-extrabold text-primary">
              {fill(t("advent.progress"), { n: data.completedCount, total: data.days.length })}
            </p>
          </header>

          <section className="grid grid-cols-6 gap-1.5">
            {data.days.map((d) => (
              <div
                key={d.day}
                title={d.title}
                className={
                  d.completed
                    ? "flex aspect-square items-center justify-center rounded-xl bg-[#f4c542] text-[#7a4a10]"
                    : "flex aspect-square items-center justify-center rounded-xl bg-muted text-xs font-bold text-muted-foreground"
                }
              >
                {d.completed ? <Check className="h-4 w-4" /> : d.day}
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">💌 {t("advent.finaleMessages")}</h2>
            {data.messages.length === 0 && <p className="text-sm text-muted-foreground">{t("advent.finaleNoMessages")}</p>}
            {data.messages.map((m, i) => (
              <figure key={i} className="break-inside-avoid rounded-2xl bg-accent/60 p-4">
                <blockquote className="whitespace-pre-line text-base">{m.text}</blockquote>
                <figcaption className="mt-2 text-xs font-bold text-primary">
                  {m.from} · {fill(t("advent.day"), { day: m.day })}
                </figcaption>
              </figure>
            ))}
          </section>

          <p className="text-center font-semibold">{t("advent.finaleOutro")}</p>
        </>
      )}
    </div>
  );
}
