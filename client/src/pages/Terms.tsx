import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/i18n/i18n";

export default function Terms() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <button onClick={() => navigate("/profile")} className="flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <h1 className="text-xl font-extrabold">{t("profile.terms")}</h1>

      <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-extrabold">Kateri podatki se zbirajo</h2>
          <p>
            Together zbira predvsem tvoje ime, e-poštni naslov in podatke o aktivnostih v aplikaciji (razpoloženja,
            odgovore na vprašanja, opravljene izzive in načrtovane zmenke).
          </p>
        </section>
        <section>
          <h2 className="font-extrabold">Za kaj uporabljamo podatke</h2>
          <p>
            Podatke uporabljamo za povezovanje partnerjev, shranjevanje razpoloženj in odgovorov, pošiljanje obvestil
            ter izboljševanje funkcionalnosti aplikacije.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold">Deljenje podatkov</h2>
          <p>Tvojih podatkov ne delimo s tretjimi osebami. Vidni so samo tebi in tvojemu povezanemu partnerju.</p>
        </section>
        <section>
          <h2 className="font-extrabold">Kje so podatki shranjeni</h2>
          <p>Podatki so shranjeni v podatkovni bazi PostgreSQL.</p>
        </section>
        <section>
          <h2 className="font-extrabold">Tvoje pravice</h2>
          <p>
            Kadar koli lahko zahtevaš dostop do svojih podatkov, njihov izbris ali prenos. Za to nas kontaktiraj prek
            e-pošte podpora@together.app.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold">Namen aplikacije</h2>
          <p>
            Together je namenjen zabavi in izboljševanju odnosa med partnerjema. Ne nadomešča strokovne terapije ali
            svetovanja.
          </p>
        </section>
      </div>
    </div>
  );
}
