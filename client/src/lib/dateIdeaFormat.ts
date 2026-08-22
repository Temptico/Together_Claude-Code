export const COST_LABELS: Record<string, string> = {
  brezplacno: "Brezplačno",
  eur: "€",
  eur2: "€€",
  eur3: "€€€",
};

export const DURATION_LABELS: Record<string, string> = {
  "30min": "30 minut",
  "1h": "1 ura",
  "2h": "2 uri",
  "2h+": "Več kot 2 uri",
};

export const CATEGORY_LABELS: Record<string, string> = {
  vse: "Vse",
  doma: "Doma",
  "na-prostem": "Na prostem",
  kulturno: "Kulturno",
  aktivno: "Aktivno",
  sprosceno: "Sproščeno",
};

export const LOCATION_TYPES: { id: string; label: string }[] = [
  { id: "restavracije", label: "Restavracije" },
  { id: "kavarne", label: "Kavarne" },
  { id: "parki", label: "Parki" },
  { id: "naravni-kraji", label: "Naravni kraji" },
  { id: "muzeji", label: "Muzeji" },
  { id: "galerije", label: "Galerije" },
  { id: "vinarije", label: "Vinarije" },
  { id: "bari", label: "Bari" },
  { id: "trznice", label: "Tržnice" },
  { id: "trgovine", label: "Trgovine" },
  { id: "plesni-studii", label: "Plesni studii" },
  { id: "rekreacijski-centri", label: "Rekreacijski centri" },
];
