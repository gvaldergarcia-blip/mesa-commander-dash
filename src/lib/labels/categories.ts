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

// Tailwind classes per category (uses semantic tokens where possible)
export const CATEGORY_COLORS: Record<string, string> = {
  "Carnes": "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400",
  "Aves": "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
  "Peixes": "bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-400",
  "Laticínios": "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-300",
  "Hortifruti": "bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400",
  "Molhos e Bases": "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400",
  "Sobremesas": "bg-pink-500/15 text-pink-600 border-pink-500/30 dark:text-pink-400",
  "Outros": "bg-muted text-muted-foreground border-border",
};

// Left-border accent hex per category (used as inline style)
export const CATEGORY_BORDER_HEX: Record<string, string> = {
  "Carnes": "#E53E3E",
  "Aves": "#DD6B20",
  "Peixes": "#3182CE",
  "Laticínios": "#D69E2E",
  "Hortifruti": "#38A169",
  "Molhos e Bases": "#805AD5",
  "Sobremesas": "#D53F8C",
  "Outros": "#718096",
};

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

export function getCategoryBorderHex(category?: string | null): string | null {
  if (!category) return null;
  return CATEGORY_BORDER_HEX[category] || null;
}

export function getCategoryIcon(category?: string | null): string {
  if (!category) return "";
  return CATEGORY_ICONS[category] || "";
}

export function getCategoryColor(category?: string | null) {
  if (!category) return CATEGORY_COLORS["Outros"];
  return CATEGORY_COLORS[category] || CATEGORY_COLORS["Outros"];
}

export type RiskLevel = "critical" | "warning" | "ok";

export function getValidityRisk(days: number): {
  level: RiskLevel;
  label: string;
  classes: string;
} {
  if (days <= 1) {
    return {
      level: "critical",
      label: "CRÍTICO",
      classes: "bg-destructive text-destructive-foreground border-destructive",
    };
  }
  if (days <= 3) {
    return {
      level: "warning",
      label: "ATENÇÃO",
      classes: "bg-yellow-500 text-yellow-950 border-yellow-600 dark:bg-yellow-500/90",
    };
  }
  return {
    level: "ok",
    label: "OK",
    classes: "bg-green-500 text-white border-green-600 dark:bg-green-500/90",
  };
}