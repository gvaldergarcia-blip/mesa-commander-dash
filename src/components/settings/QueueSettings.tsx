import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Clock, Info, Loader2 } from 'lucide-react';
import { useQueueSettings } from '@/hooks/useQueueSettings';
import { useQueueWaitTimeAveragesEnhanced } from '@/hooks/useQueueWaitTimeAveragesEnhanced';
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
});

type QueueSettingsFormValues = z.infer<typeof queueSettingsSchema>;

export function QueueSettings({ restaurantId }: { restaurantId: string }) {
  const { settings, loading, saveSettings } = useQueueSettings(restaurantId);
  const { todayAverages, historicalAverages, loading: loadingAverages } = useQueueWaitTimeAveragesEnhanced(restaurantId);
  const [saving, setSaving] = useState(false);

  const form = useForm<QueueSettingsFormValues>({
    resolver: zodResolver(queueSettingsSchema),
    defaultValues: {
      max_party_size: 8,
      queue_capacity: 50,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        max_party_size: settings.max_party_size,
        queue_capacity: settings.queue_capacity,
      });
    }
  }, [settings]);

  const onSubmit = async (values: QueueSettingsFormValues) => {
    setSaving(true);
    await saveSettings({
      restaurant_id: restaurantId,
      max_party_size: values.max_party_size,
      queue_capacity: values.queue_capacity,
      // Keep existing avg times since they're not editable anymore
      avg_time_1_2: settings?.avg_time_1_2 || 30,
      avg_time_3_4: settings?.avg_time_3_4 || 45,
      avg_time_5_6: settings?.avg_time_5_6 || 60,
      avg_time_7_8: settings?.avg_time_7_8 || 75,
    });
    setSaving(false);
  };

  // Get display value for a size range
  const getDisplayValue = (sizeRange: string) => {
    const todayValue = todayAverages[sizeRange];
    const historicalValue = historicalAverages[sizeRange];

    if (todayValue !== undefined && todayValue !== null) {
      return {
        value: `${todayValue} min`,
        source: 'hoje',
        hasData: true,
      };
    }

    if (historicalValue !== undefined && historicalValue !== null) {
      return {
        value: `${historicalValue} min`,
        source: 'últimos 7 dias',
        hasData: true,
      };
    }

    return {
      value: 'Sem dados suficientes',
      source: null,
      hasData: false,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const sizeRanges = [
    { key: '1-2', label: '1–2 pessoas' },
    { key: '3-4', label: '3–4 pessoas' },
    { key: '5-6', label: '5–6 pessoas' },
    { key: '7+', label: '7–8 pessoas' },
  ];

  return (
    <div className="space-y-6">
      {/* Bloco A - Limites da Fila */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Limites da Fila
              </CardTitle>
              <CardDescription>
                Defina os limites e capacidades da fila de espera do seu restaurante.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="max_party_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tamanho máximo por grupo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
                      <FormLabel>Capacidade máxima da fila (número de grupos)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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

              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar configurações da fila'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Bloco B - Tempo Médio (Somente Leitura) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Tempo médio hoje por tamanho de grupo (automático)
          </CardTitle>
          <CardDescription className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            O MesaClik calcula o tempo com base nas mesas já sentadas hoje. Se não houver dados de hoje, usa a média dos últimos 7 dias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAverages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sizeRanges.map((range) => {
                const display = getDisplayValue(range.key);
                return (
                  <div
                    key={range.key}
                    className={`p-4 rounded-lg border ${
                      display.hasData ? 'bg-background' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{range.label}</span>
                      <span className={`text-lg font-semibold ${
                        display.hasData ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {display.value}
                      </span>
                    </div>
                    {display.source && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Baseado em dados de {display.source}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-muted/30 border">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Dica:</strong> Estes tempos são calculados automaticamente e atualizados conforme grupos são sentados. Quanto mais dados, mais precisa será a estimativa.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
