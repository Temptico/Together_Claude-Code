type T = (key: string) => string;

export const COST_IDS = ["brezplacno", "eur", "eur2", "eur3"];
export const DURATION_IDS = ["30min", "1h", "2h", "2h+"];
export const DATE_CATEGORY_IDS = ["vse", "doma", "na-prostem", "kulturno", "aktivno", "sprosceno"];
export const LOCATION_TYPE_IDS = [
  "restavracije",
  "kavarne",
  "parki",
  "naravni-kraji",
  "muzeji",
  "galerije",
  "vinarije",
  "bari",
  "trznice",
  "trgovine",
  "plesni-studii",
  "rekreacijski-centri",
  "gledalisca",
  "knjiznice",
];

export function costLabel(t: T, cost: string): string {
  return t(`cost.${cost}`);
}

export function durationLabel(t: T, duration: string): string {
  return t(`duration.${duration}`);
}

export function categoryLabel(t: T, category: string): string {
  return t(`category.${category}`);
}

export function locationTypeLabel(t: T, id: string): string {
  return t(`locationType.${id}`);
}
