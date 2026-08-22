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
      <p className="text-xs text-muted-foreground">Zadnja posodobitev: 22. avgust 2026</p>

      <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-extrabold">1. Upravljavec podatkov</h2>
          <p>
            Aplikacijo Together upravlja in je odgovoren za obdelavo osebnih podatkov:
          </p>
          <p className="mt-2 rounded-2xl bg-muted p-3">
            <strong>Enigma 101 global j.d.o.o.</strong>
            <br />
            Gajeva ulica 42, Zagreb, Hrvaška
            <br />
            Matična številka: 081673164
            <br />
            Davčna številka: HR03945849423
            <br />
            E-pošta: <a href="mailto:info@temptico.com" className="text-primary underline">info@temptico.com</a>
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">2. Kateri podatki se zbirajo</h2>
          <p>Pri uporabi aplikacije zbiramo:</p>
          <ul className="mt-1 list-disc pl-5">
            <li>osnovne podatke o računu: ime in e-poštni naslov;</li>
            <li>podatke o partnerski povezavi: povezovalno kodo in identiteto povezanega partnerja;</li>
            <li>vsebinske podatke, ki jih ustvariš v aplikaciji: dnevna razpoloženja, odgovore na vprašanja, opravljene izzive, lastna vprašanja/izzive, načrtovane zmenke in fotografije, ki jih naložiš k zmenku;</li>
            <li>nastavitve: jezik, datum obletnice, nastavitve obvestil;</li>
            <li>tehnične podatke, potrebne za pošiljanje obvestil (naročnina na push obvestila), če jih omogočiš;</li>
            <li>lokacijo naprave zgolj v trenutku, ko sam/a sprožiš iskanje "Najdi v bližini" — lokacije ne shranjujemo trajno.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-extrabold">3. Namen in pravna podlaga obdelave</h2>
          <p>
            Podatke obdelujemo za izvajanje storitve, h kateri pristopiš z registracijo (izvajanje pogodbe): za
            povezovanje partnerjev, prikaz vsebin drug drugemu, pošiljanje obvestil in delovanje funkcij aplikacije.
            Kjer je to potrebno (npr. push obvestila, lokacija), te za privolitev vprašamo posebej, privolitev pa
            lahko kadar koli prekličeš v nastavitvah naprave oz. profila.
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">4. Deljenje podatkov</h2>
          <p>
            Tvojih osebnih podatkov ne prodajamo in jih ne delimo za namene trženja tretjih strani. Vsebina, ki jo
            ustvariš (razpoloženja, odgovori, zmenki, fotografije), je vidna izključno tebi in tvojemu povezanemu
            partnerju. Za tehnično delovanje aplikacije uporabljamo naslednje izvajalce obdelave (procesorje), ki
            podatke hranijo ali obdelujejo v našem imenu:
          </p>
          <ul className="mt-1 list-disc pl-5">
            <li>ponudnik gostovanja podatkovne baze (PostgreSQL, gostuje pri Neon);</li>
            <li>ponudnik gostovanja aplikacije (Render);</li>
            <li>ponudnik storitve push obvestil, kadar jih omogočiš.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-extrabold">5. Kje in kako dolgo hranimo podatke</h2>
          <p>
            Podatki so shranjeni v podatkovni bazi PostgreSQL pri gostitelju Neon. Podatke hranimo, dokler ima
            uporabnik aktiven račun v aplikaciji. Račun in vse podatke lahko kadar koli takoj in samodejno izbrišeš
            sam v profilu ("Izbriši račun"), lahko pa zahtevo pošlješ tudi na e-pošto spodaj — v obeh primerih so
            podatki trajno odstranjeni takoj.
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">6. Tvoje pravice</h2>
          <p>V skladu s Splošno uredbo o varstvu podatkov (GDPR) imaš pravico do:</p>
          <ul className="mt-1 list-disc pl-5">
            <li>dostopa do svojih osebnih podatkov;</li>
            <li>popravka netočnih podatkov;</li>
            <li>izbrisa podatkov ("pravica do pozabe");</li>
            <li>omejitve ali ugovora obdelavi;</li>
            <li>prenosljivosti podatkov;</li>
            <li>pritožbe pri pristojnem nadzornem organu za varstvo osebnih podatkov (npr. hrvaški AZOP ali slovenski Informacijski pooblaščenec, glede na tvoje prebivališče).</li>
          </ul>
          <p className="mt-1">
            Zahtevo za uveljavljanje katere koli od teh pravic pošlji na{" "}
            <a href="mailto:info@temptico.com" className="text-primary underline">info@temptico.com</a>.
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">7. Lokalna shramba naprave</h2>
          <p>
            Za prijavo brez gesla aplikacija v lokalno shrambo tvojega brskalnika (localStorage) shrani identifikator
            seje in izbran jezik/temo. Ti podatki ostanejo na tvoji napravi in se izbrišejo ob odjavi.
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">8. Namen aplikacije in omejitev odgovornosti</h2>
          <p>
            Together je namenjen zabavi in izboljševanju komunikacije med partnerjema. Ne nadomešča strokovne
            terapije, psihološkega svetovanja ali zdravstvene oskrbe. Za resnejše odnosne ali čustvene težave
            priporočamo posvet s strokovnjakom.
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">9. Spremembe pogojev</h2>
          <p>
            Te pogoje lahko občasno posodobimo. O pomembnejših spremembah te obvestimo znotraj aplikacije. Nadaljnja
            uporaba aplikacije po objavi sprememb pomeni strinjanje s posodobljenimi pogoji.
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">10. Kontakt</h2>
          <p>
            Za vsa vprašanja v zvezi s temi pogoji ali obdelavo tvojih podatkov nas kontaktiraj na{" "}
            <a href="mailto:info@temptico.com" className="text-primary underline">info@temptico.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
