import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Clock, Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type DayHours = {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

const DAYS = [
  // IMPORTANTE: day_of_week segue o padrão do Postgres EXTRACT(DOW):
  // 0=Domingo, 1=Segunda, ..., 6=Sábado
  // Mantemos a UI em ordem Seg→Dom, mas salvamos no banco com esses valores.
  { label: 'Segunda-feira', db_day_of_week: 1 },
  { label: 'Terça-feira', db_day_of_week: 2 },
  { label: 'Quarta-feira', db_day_of_week: 3 },
  { label: 'Quinta-feira', db_day_of_week: 4 },
  { label: 'Sexta-feira', db_day_of_week: 5 },
  { label: 'Sábado', db_day_of_week: 6 },
  { label: 'Domingo', db_day_of_week: 0 },
];

export function HoursSettings({ restaurantId }: { restaurantId: string }) {
  const [weekHours, setWeekHours] = useState<DayHours[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Usar schema mesaclik (fonte de verdade para a Tela Comando/app)
      const { data: hoursData, error } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurant_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('day_of_week');

      if (error) throw error;

      if (hoursData && hoursData.length > 0) {
        // Map existing data with proper typing
        type HourRecord = { day_of_week: number; open_time: string | null; close_time: string | null };
        const hoursMap = new Map<number, HourRecord>(
          hoursData.map((h: HourRecord) => [h.day_of_week, h])
        );

        setWeekHours(
          DAYS.map((day) => {
            const existing = hoursMap.get(day.db_day_of_week);
            return {
              day_of_week: day.db_day_of_week,
              is_open: existing ? existing.open_time !== null && existing.close_time !== null : true,
              open_time: existing?.open_time || '08:00',
              close_time: existing?.close_time || '22:00',
            };
          })
        );
      } else {
        // Initialize with default hours (all days open)
        setWeekHours(
          DAYS.map((day) => ({
            day_of_week: day.db_day_of_week,
            is_open: true,
            open_time: '08:00',
            close_time: '22:00',
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching hours data:', error);
      // Initialize with defaults on error
       setWeekHours(
         DAYS.map((day) => ({
           day_of_week: day.db_day_of_week,
           is_open: true,
           open_time: '08:00',
           close_time: '22:00',
         }))
       );
    } finally {
      setLoading(false);
    }
  };

  const applyMondayToAll = () => {
    if (weekHours.length === 0) return;
    const monday = weekHours[0]; // Monday is index 0
    
    setWeekHours(weekHours.map(h => ({
      ...h,
      // Only apply hours to days that are open
      open_time: h.is_open ? monday.open_time : h.open_time,
      close_time: h.is_open ? monday.close_time : h.close_time,
    })));

    toast({
      title: "Horários aplicados",
      description: "Os horários da segunda-feira foram aplicados a todos os dias abertos.",
    });
  };

  const saveAllHours = async () => {
    try {
      setSaving(true);

      const hoursToInsert = weekHours.map(h => ({
        restaurant_id: restaurantId,
        day_of_week: h.day_of_week,
        open_time: h.is_open ? h.open_time : null,
        close_time: h.is_open ? h.close_time : null,
      }));

      // 1) Salvar no mesaclik (fonte de verdade do painel)
      await (supabase as any)
        .schema('mesaclik')
        .from('restaurant_hours')
        .delete()
        .eq('restaurant_id', restaurantId);

      const { error: mesaclikError } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurant_hours')
        .insert(hoursToInsert);

      if (mesaclikError) throw mesaclikError;

      // 2) Sincronizar para public (onde o Flutter app lê)
      await supabase
        .from('restaurant_hours')
        .delete()
        .eq('restaurant_id', restaurantId);

      const { error: publicError } = await supabase
        .from('restaurant_hours')
        .insert(hoursToInsert);

      if (publicError) {
        console.warn('Erro ao sincronizar para public:', publicError);
        // Não falha a operação, pois mesaclik foi salvo
      }

      toast({
        title: "Horários salvos",
        description: "Os horários de funcionamento foram atualizados e sincronizados.",
      });
    } catch (error) {
      console.error('Error saving hours:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os horários.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateDayHours = (index: number, field: keyof DayHours, value: any) => {
    const newHours = [...weekHours];
    newHours[index] = { ...newHours[index], [field]: value };
    setWeekHours(newHours);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Horários de funcionamento
        </CardTitle>
        <CardDescription>
          Defina os horários de abertura e fechamento para cada dia da semana.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Apply to all button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applyMondayToAll}
          className="flex items-center gap-2"
        >
          <Copy className="h-4 w-4" />
          Aplicar horário de segunda a todos os dias
        </Button>

        {/* Days grid */}
        <div className="space-y-4">
          {weekHours.map((day, index) => (
            <div 
              key={day.day_of_week} 
              className={`grid grid-cols-[180px_100px_1fr_1fr] gap-4 items-center p-3 rounded-lg border ${
                day.is_open ? 'bg-background' : 'bg-muted/50'
              }`}
            >
              {/* Day name */}
              <Label className="font-medium text-sm">
                {DAYS[index].label}
              </Label>

              {/* Open/Closed toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={day.is_open}
                  onCheckedChange={(checked) => updateDayHours(index, 'is_open', checked)}
                />
                <span className={`text-sm ${day.is_open ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                  {day.is_open ? 'Aberto' : 'Fechado'}
                </span>
              </div>

              {/* Opening time */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Abre:</Label>
                <Input
                  type="time"
                  value={day.open_time}
                  onChange={(e) => updateDayHours(index, 'open_time', e.target.value)}
                  disabled={!day.is_open}
                  className="h-9"
                />
              </div>

              {/* Closing time */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Fecha:</Label>
                <Input
                  type="time"
                  value={day.close_time}
                  onChange={(e) => updateDayHours(index, 'close_time', e.target.value)}
                  disabled={!day.is_open}
                  className="h-9"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4">
          <Button
            type="button"
            onClick={saveAllHours}
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar horários'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
