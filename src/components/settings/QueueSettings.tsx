import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Clock } from 'lucide-react';
import { useQueueSettings } from '@/hooks/useQueueSettings';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';

const queueSettingsSchema = z.object({
  max_party_size: z.number().min(1).max(50),
  queue_capacity: z.number().min(1).max(500),
  avg_time_1_2: z.number().min(5).max(180),
  avg_time_3_4: z.number().min(5).max(180),
  avg_time_5_6: z.number().min(5).max(180),
  avg_time_7_8: z.number().min(5).max(180),
});

type QueueSettingsFormValues = z.infer<typeof queueSettingsSchema>;

export function QueueSettings({ restaurantId }: { restaurantId: string }) {
  const { settings, loading, saveSettings } = useQueueSettings(restaurantId);

  const form = useForm<QueueSettingsFormValues>({
    resolver: zodResolver(queueSettingsSchema),
    defaultValues: {
      max_party_size: 8,
      queue_capacity: 50,
      avg_time_1_2: 30,
      avg_time_3_4: 45,
      avg_time_5_6: 60,
      avg_time_7_8: 75,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        max_party_size: settings.max_party_size,
        queue_capacity: settings.queue_capacity,
        avg_time_1_2: settings.avg_time_1_2,
        avg_time_3_4: settings.avg_time_3_4,
        avg_time_5_6: settings.avg_time_5_6,
        avg_time_7_8: settings.avg_time_7_8,
      });
    }
  }, [settings]);

  const onSubmit = async (values: QueueSettingsFormValues) => {
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
              <Users className="h-5 w-5 text-primary" />
              Configurações da Fila
            </CardTitle>
            <CardDescription>
              Defina os limites e capacidades da fila de espera
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="max_party_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tamanho Máximo por Grupo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Número máximo de pessoas permitidas por grupo na fila
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="queue_capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidade Máxima da Fila</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Número máximo de grupos que podem estar na fila simultaneamente
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Tempo Médio Base por Tamanho de Grupo
            </CardTitle>
            <CardDescription>
              Configure os tempos médios de espera (em minutos) para cada faixa de tamanho de grupo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="avg_time_1_2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>1-2 pessoas</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">min</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avg_time_3_4"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>3-4 pessoas</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">min</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avg_time_5_6"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>5-6 pessoas</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">min</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avg_time_7_8"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>7-8 pessoas</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">min</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Salvar Configurações</Button>
        </div>
      </form>
    </Form>
  );
}
