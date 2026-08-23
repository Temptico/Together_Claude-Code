import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/i18n/i18n";
import { translations } from "@/i18n/translations";

export default function Terms() {
  const { t, lang } = useTranslation();
  const [, navigate] = useLocation();
  const terms = translations[lang].terms;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <button onClick={() => navigate("/profile")} className="flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <h1 className="text-xl font-extrabold">{t("profile.terms")}</h1>
      <p className="text-xs text-muted-foreground">{terms.updated}</p>

      <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-extrabold">{terms.s1Heading}</h2>
          <p>{terms.companyIntro}</p>
          <p className="mt-2 rounded-2xl bg-muted p-3">
            <strong>{terms.companyName}</strong>
            <br />
            {terms.companyAddress}
            <br />
            {terms.companyRegLabel} {terms.companyRegNo}
            <br />
            {terms.companyTaxLabel} {terms.companyTaxNo}
            <br />
            {terms.companyEmailLabel}{" "}
            <a href="mailto:info@temptico.com" className="text-primary underline">
              info@temptico.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s2Heading}</h2>
          <p>{terms.s2Intro}</p>
          <ul className="mt-1 list-disc pl-5">
            {terms.s2List.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s3Heading}</h2>
          <p>{terms.s3Body}</p>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s4Heading}</h2>
          <p>{terms.s4Intro}</p>
          <ul className="mt-1 list-disc pl-5">
            {terms.s4List.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s5Heading}</h2>
          <p>{terms.s5Body}</p>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s6Heading}</h2>
          <p>{terms.s6Intro}</p>
          <ul className="mt-1 list-disc pl-5">
            {terms.s6List.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p className="mt-1">
            {terms.s6RequestNote}{" "}
            <a href="mailto:info@temptico.com" className="text-primary underline">
              info@temptico.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s7Heading}</h2>
          <p>{terms.s7Body}</p>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s8Heading}</h2>
          <p>{terms.s8Body}</p>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s9Heading}</h2>
          <p>{terms.s9Body}</p>
        </section>

        <section>
          <h2 className="font-extrabold">{terms.s10Heading}</h2>
          <p>
            {terms.s10ContactNote}{" "}
            <a href="mailto:info@temptico.com" className="text-primary underline">
              info@temptico.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
