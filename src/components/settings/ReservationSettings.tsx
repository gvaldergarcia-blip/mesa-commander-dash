import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Clock } from 'lucide-react';
import { useReservationSettings } from '@/hooks/useReservationSettings';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';

const reservationSettingsSchema = z.object({
  max_party_size: z.number().min(1).max(50),
  tolerance_minutes: z.number().min(0).max(120),
});

type ReservationSettingsFormValues = z.infer<typeof reservationSettingsSchema>;

export function ReservationSettings({ restaurantId }: { restaurantId: string }) {
  const { settings, loading, saveSettings } = useReservationSettings(restaurantId);

  const form = useForm<ReservationSettingsFormValues>({
    resolver: zodResolver(reservationSettingsSchema),
    defaultValues: {
      max_party_size: 8,
      tolerance_minutes: 15,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        max_party_size: settings.max_party_size,
        tolerance_minutes: settings.tolerance_minutes,
      });
    }
  }, [settings]);

  const onSubmit = async (values: ReservationSettingsFormValues) => {
    await saveSettings({
      restaurant_id: restaurantId,
      ...values,
    });
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Configurações de Reservas
            </CardTitle>
            <CardDescription>
              Defina os limites e políticas para reservas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="max_party_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tamanho Máximo do Grupo</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Número máximo de pessoas permitidas por reserva
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tolerance_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Tempo de Tolerância
                  </FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <span className="text-sm text-muted-foreground">minutos</span>
                  </div>
                  <FormDescription>
                    Tempo de tolerância após o horário marcado antes de considerar "não compareceu"
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Salvar Configurações</Button>
        </div>
      </form>
    </Form>
  );
}
