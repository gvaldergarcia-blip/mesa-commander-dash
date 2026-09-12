export type ModuleKey =
  | "dashboard"
  | "fila"
  | "reservas"
  | "clientes"
  | "promocoes"
  | "relatorios"
  | "checklist"
  | "etiquetas"
  | "marketing_ia"
  | "studio";

export type ModuleIcon =
  | "LayoutDashboard"
  | "Users"
  | "Calendar"
  | "UserCheck"
  | "Megaphone"
  | "BarChart3"
  | "ClipboardList"
  | "Tag"
  | "Film"
  | "Sparkles";

export interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  shortName: string;
  href: string;
  icon: ModuleIcon;
  /** Módulo só aparece para administradores do restaurante */
  adminOnly: boolean;
  /** Feature flag global que precisa estar ativa para o módulo existir */
  featureFlag?: keyof typeof import("./feature-flags").FEATURE_FLAGS;
  /** Se true, o módulo é o destino padrão quando é o único contratado */
  canBeHome: boolean;
  /** Descrição curta usada na tela de plano */
  description: string;
}

export const MODULES: ModuleDefinition[] = [
  {
    key: "dashboard",
    name: "Dashboard",
    shortName: "Painel",
    href: "/dashboard",
    icon: "LayoutDashboard",
    adminOnly: false,
    canBeHome: false,
    description: "Visão geral do restaurante",
  },
  {
    key: "fila",
    name: "Fila",
    shortName: "Fila",
    href: "/queue",
    icon: "Users",
    adminOnly: false,
    canBeHome: true,
    description: "Gerencie a espera dos clientes com fila digital",
  },
  {
    key: "reservas",
    name: "Reservas",
    shortName: "Reservas",
    href: "/reservations",
    icon: "Calendar",
    adminOnly: false,
    canBeHome: true,
    description: "Aceite e gerencie reservas online",
  },
  {
    key: "clientes",
    name: "Clientes",
    shortName: "Clientes",
    href: "/customers",
    icon: "UserCheck",
    adminOnly: true,
    canBeHome: true,
    description: "Base de clientes e histórico de visitas",
  },
  {
    key: "promocoes",
    name: "Promoções",
    shortName: "Promoções",
    href: "/promotions",
    icon: "Megaphone",
    adminOnly: true,
    featureFlag: "CUPONS_ENABLED",
    canBeHome: false,
    description: "Campanhas e cupons de desconto",
  },
  {
    key: "relatorios",
    name: "Relatórios",
    shortName: "Relatórios",
    href: "/reports",
    icon: "BarChart3",
    adminOnly: true,
    canBeHome: false,
    description: "Métricas e relatórios do restaurante",
  },
  {
    key: "checklist",
    name: "Checklists",
    shortName: "Checklists",
    href: "/checklists",
    icon: "ClipboardList",
    adminOnly: false,
    canBeHome: true,
    description: "Listas de verificação da operação",
  },
  {
    key: "etiquetas",
    name: "Etiquetas",
    shortName: "Etiquetas",
    href: "/etiquetas",
    icon: "Tag",
    adminOnly: false,
    canBeHome: true,
    description: "Controle de validade e rastreabilidade de produtos",
  },
  {
    key: "marketing_ia",
    name: "Marketing IA",
    shortName: "Marketing IA",
    href: "/marketing/video",
    icon: "Film",
    adminOnly: true,
    featureFlag: "MARKETING_IA_ENABLED",
    canBeHome: false,
    description: "Geração de vídeos e posts com inteligência artificial",
  },
  {
    key: "studio",
    name: "MesaClik Studio",
    shortName: "Studio",
    href: "/marketing/creator",
    icon: "Sparkles",
    adminOnly: true,
    canBeHome: false,
    description: "Crie imagens e conteúdo para redes sociais",
  },
];

export const MODULES_BY_KEY: Record<ModuleKey, ModuleDefinition> = MODULES.reduce(
  (acc, mod) => {
    acc[mod.key] = mod;
    return acc;
  },
  {} as Record<ModuleKey, ModuleDefinition>
);

/** Módulos que podem ser contratados separadamente (exclui dashboard). */
export const CONTRACTABLE_MODULES = MODULES.filter((m) => m.key !== "dashboard");
