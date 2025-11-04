import { z } from 'zod';

export const reservationSchema = z.object({
  customer_name: z.string()
    .trim()
    .min(2, { message: "Nome deve ter pelo menos 2 caracteres" })
    .max(100, { message: "Nome muito longo (máximo 100 caracteres)" }),
  
  phone: z.string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, { 
      message: "Telefone inválido. Use formato: +5511999999999" 
    }),
  
  date: z.string()
    .min(1, { message: "Data é obrigatória" }),
  
  time: z.string()
    .min(1, { message: "Horário é obrigatório" }),
  
  party_size: z.number()
    .int()
    .min(1, { message: "Mínimo 1 pessoa" })
    .max(8, { message: "Máximo 8 pessoas" }),
  
  notes: z.string().optional(),
}).refine((data) => {
  // Validar data futura
  const datetime = new Date(`${data.date}T${data.time}`);
  const now = new Date();
  return datetime > now;
}, {
  message: "⛔ Data e horário devem ser futuros",
  path: ["date"]
});

export type ReservationInput = z.infer<typeof reservationSchema>;

// Converter para UTC
export function normalizeReservationToUTC(data: ReservationInput) {
  const localDateTime = new Date(`${data.date}T${data.time}`);
  return {
    customer_name: data.customer_name,
    phone: data.phone,
    starts_at: localDateTime.toISOString(),
    people: data.party_size,
    notes: data.notes,
  };
}

// Converter de UTC para local (para exibição)
export function denormalizeReservationFromUTC(utcDate: string) {
  const date = new Date(utcDate);
  return {
    date: date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    time: date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  };
}
