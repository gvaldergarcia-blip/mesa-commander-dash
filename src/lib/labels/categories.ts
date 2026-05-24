import type { CSSProperties } from "react";

export const PRODUCT_CATEGORIES = [
  "Carnes",
  "Aves",
  "Peixes",
  "Laticínios",
  "Hortifruti",
  "Molhos e Bases",
  "Sobremesas",
  "Outros",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// Hex accent per category (left border + tinted tags + filter pills)
export const CATEGORY_HEX: Record<string, string> = {
  "Carnes": "#E53E3E",
  "Aves": "#ED8936",
  "Peixes": "#4299E1",
  "Laticínios": "#ECC94B",
  "Hortifruti": "#48BB78",
  "Molhos e Bases": "#9F7AEA",
  "Sobremesas": "#ED64A6",
  "Outros": "#718096",
};

// Used when product has no category (sentinel)
export const NO_CATEGORY_HEX = "#FF6B00";

export const CATEGORY_ICONS: Record<string, string> = {
  "Carnes": "🥩",
  "Aves": "🍗",
  "Peixes": "🐟",
  "Laticínios": "🧀",
  "Hortifruti": "🥦",
  "Molhos e Bases": "🍅",
  "Sobremesas": "🍮",
  "Outros": "",
};

export function getCategoryHex(category?: string | null): string {
  if (!category) return NO_CATEGORY_HEX;
  return CATEGORY_HEX[category] || CATEGORY_HEX["Outros"];
}

export function getCategoryBorderHex(category?: string | null): string {
  return getCategoryHex(category);
}

export function getCategoryIcon(category?: string | null): string {
  if (!category) return "";
  return CATEGORY_ICONS[category] || "";
}

// Tinted pill style (15% bg + accent text)
export function getCategoryTagStyle(category?: string | null): CSSProperties {
  const hex = getCategoryHex(category);
  return {
    backgroundColor: `${hex}26`,
    color: hex,
    borderColor: `${hex}40`,
  };
}

// Backwards-compat (no-op, kept so old imports don't break)
export function getCategoryColor(_category?: string | null): string {
  return "";
}

export type RiskLevel = "critical" | "warning" | "ok";

export function getValidityRisk(days: number): {
  level: RiskLevel;
  label: string;
  style: CSSProperties;
} {
  if (days <= 1) {
    return {
      level: "critical",
      label: "CRÍTICO",
      style: { backgroundColor: "#742A2A", color: "#FC8181" },
    };
  }
  if (days <= 3) {
    return {
      level: "warning",
      label: "ATENÇÃO",
      style: { backgroundColor: "#744210", color: "#F6AD55" },
    };
  }
  return {
    level: "ok",
    label: "OK",
    style: { backgroundColor: "#1C4532", color: "#68D391" },
  };
}