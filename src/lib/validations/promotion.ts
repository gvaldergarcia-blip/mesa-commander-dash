import { z } from 'zod';

export const promotionSchema = z.object({
  title: z.string()
    .trim()
    .min(3, { message: "Título deve ter pelo menos 3 caracteres" })
    .max(100, { message: "Título muito longo (máximo 100 caracteres)" }),
  
  description: z.string()
    .trim()
    .max(1000, { message: "Descrição muito longa (máximo 1000 caracteres)" })
    .optional(),
  
  starts_at: z.string()
    .min(1, { message: "Data de início é obrigatória" }),
  
  ends_at: z.string()
    .min(1, { message: "Data de término é obrigatória" }),
  
  audience_filter: z.string()
    .min(1, { message: "Público-alvo é obrigatório" }),
  
  restaurant_id: z.string().uuid(),
}).refine((data) => {
  // Validar ends_at > starts_at
  const start = new Date(data.starts_at);
  const end = new Date(data.ends_at);
  return end > start;
}, {
  message: "⛔ Término da promoção deve ser após o início",
  path: ["ends_at"]
}).refine((data) => {
  // Validar que o início não é no passado
  const start = new Date(data.starts_at);
  const now = new Date();
  return start >= now;
}, {
  message: "⛔ Data de início deve ser futura ou atual",
  path: ["starts_at"]
});

export type PromotionInput = z.infer<typeof promotionSchema>;

// Normalizar para UTC
export function normalizePromotionToUTC(data: PromotionInput) {
  return {
    ...data,
    starts_at: new Date(data.starts_at).toISOString(),
    ends_at: new Date(data.ends_at).toISOString(),
  };
}

// Determinar status com base nas datas
export function calculatePromotionStatus(startsAt: string, endsAt: string): 'draft' | 'active' | 'completed' {
  const now = new Date();
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  
  if (now < start) return 'draft'; // Ainda não começou
  if (now > end) return 'completed'; // Já terminou
  return 'active'; // Está ativa
}
