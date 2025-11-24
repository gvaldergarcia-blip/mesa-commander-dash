import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Plus, Trash2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type DayHours = {
  day_of_week: number;
  open_time: string;
  close_time: string;
};

type SpecialDate = {
  id?: string;
  date: string;
  open_time: string;
  close_time: string;
  reason: string;
};

type Closure = {
  id?: string;
  date: string;
  reason: string;
};

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export function HoursSettings({ restaurantId }: { restaurantId: string }) {
  const [weekHours, setWeekHours] = useState<DayHours[]>([]);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    try {
      // Fetch regular hours
      const { data: hoursData } = await supabase
        .from('restaurant_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('day_of_week');

      if (hoursData) {
        setWeekHours(hoursData.map(h => ({
          day_of_week: h.day_of_week || 0,
          open_time: h.open_time || '08:00',
          close_time: h.close_time || '22:00',
        })));
      } else {
        // Initialize with default hours
        setWeekHours(Array.from({ length: 7 }, (_, i) => ({
          day_of_week: i,
          open_time: '08:00',
          close_time: '22:00',
        })));
      }

      // Fetch special dates
      const { data: specialData } = await supabase
        .from('restaurant_special_dates')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('date');

      if (specialData) {
        setSpecialDates(specialData.map(d => ({
          id: d.id,
          date: d.date,
          open_time: d.open_time || '08:00',
          close_time: d.close_time || '22:00',
          reason: d.reason || '',
        })));
      }

      // Fetch closures
      const { data: closuresData } = await supabase
        .from('restaurant_closures')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('date');

      if (closuresData) {
        setClosures(closuresData.map(c => ({
          id: c.id,
          date: c.date,
          reason: c.reason || '',
        })));
      }
    } catch (error) {
      console.error('Error fetching hours data:', error);
    }
  };

  const applyToAllDays = () => {
    if (weekHours.length === 0) return;
    const firstDay = weekHours[0];
    setWeekHours(weekHours.map(h => ({
      ...h,
      open_time: firstDay.open_time,
      close_time: firstDay.close_time,
    })));
  };

  const saveAllHours = async () => {
    try {
      setSaving(true);

      // Delete existing hours
      await supabase
        .from('restaurant_hours')
        .delete()
        .eq('restaurant_id', restaurantId);

      // Insert new hours
      const hoursToInsert = weekHours.map(h => ({
        restaurant_id: restaurantId,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
      }));

      const { error } = await supabase
        .from('restaurant_hours')
        .insert(hoursToInsert);

      if (error) throw error;

      toast({
        title: "Horários salvos",
        description: "Os horários de funcionamento foram atualizados.",
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

  const addSpecialDate = async () => {
    const newDate: SpecialDate = {
      date: new Date().toISOString().split('T')[0],
      open_time: '08:00',
      close_time: '22:00',
      reason: '',
    };

    try {
      const { data, error } = await supabase
        .from('restaurant_special_dates')
        .insert({
          restaurant_id: restaurantId,
          date: newDate.date,
          open_time: newDate.open_time,
          close_time: newDate.close_time,
          reason: newDate.reason,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setSpecialDates([...specialDates, { ...newDate, id: data.id }]);
      }

      toast({
        title: "Data especial adicionada",
      });
    } catch (error) {
      console.error('Error adding special date:', error);
      toast({
        title: "Erro",
        variant: "destructive",
      });
    }
  };

  const deleteSpecialDate = async (id?: string) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('restaurant_special_dates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSpecialDates(specialDates.filter(d => d.id !== id));

      toast({
        title: "Data especial removida",
      });
    } catch (error) {
      console.error('Error deleting special date:', error);
    }
  };

  const addClosure = async () => {
    const newClosure: Closure = {
      date: new Date().toISOString().split('T')[0],
      reason: '',
    };

    try {
      const { data, error } = await supabase
        .from('restaurant_closures')
        .insert({
          restaurant_id: restaurantId,
          date: newClosure.date,
          reason: newClosure.reason,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setClosures([...closures, { ...newClosure, id: data.id }]);
      }

      toast({
        title: "Fechamento adicionado",
      });
    } catch (error) {
      console.error('Error adding closure:', error);
      toast({
        title: "Erro",
        variant: "destructive",
      });
    }
  };

  const deleteClosure = async (id?: string) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('restaurant_closures')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setClosures(closures.filter(c => c.id !== id));

      toast({
        title: "Fechamento removido",
      });
    } catch (error) {
      console.error('Error deleting closure:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Horários Regulares */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Horários de Funcionamento
          </CardTitle>
          <CardDescription>
            Defina os horários de abertura e fechamento para cada dia da semana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {weekHours.map((day, index) => (
            <div key={index} className="grid grid-cols-3 gap-4 items-center">
              <Label className="font-medium">{DAYS[day.day_of_week]}</Label>
              <Input
                type="time"
                value={day.open_time}
                onChange={(e) => {
                  const newHours = [...weekHours];
                  newHours[index].open_time = e.target.value;
                  setWeekHours(newHours);
                }}
              />
              <Input
                type="time"
                value={day.close_time}
                onChange={(e) => {
                  const newHours = [...weekHours];
                  newHours[index].close_time = e.target.value;
                  setWeekHours(newHours);
                }}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyToAllDays}
            >
              <Copy className="h-4 w-4 mr-2" />
              Aplicar horário da segunda a todos os dias
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveAllHours}
              disabled={saving}
            >
              Salvar Horários
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Datas Especiais */}
      <Card>
        <CardHeader>
          <CardTitle>Datas Especiais</CardTitle>
          <CardDescription>
            Defina horários diferentes para datas específicas (feriados, eventos)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {specialDates.map((special, index) => (
            <div key={special.id || index} className="grid grid-cols-5 gap-2 items-center">
              <Input
                type="date"
                value={special.date}
                onChange={(e) => {
                  const newDates = [...specialDates];
                  newDates[index].date = e.target.value;
                  setSpecialDates(newDates);
                }}
              />
              <Input
                type="time"
                value={special.open_time}
                onChange={(e) => {
                  const newDates = [...specialDates];
                  newDates[index].open_time = e.target.value;
                  setSpecialDates(newDates);
                }}
              />
              <Input
                type="time"
                value={special.close_time}
                onChange={(e) => {
                  const newDates = [...specialDates];
                  newDates[index].close_time = e.target.value;
                  setSpecialDates(newDates);
                }}
              />
              <Input
                placeholder="Motivo"
                value={special.reason}
                onChange={(e) => {
                  const newDates = [...specialDates];
                  newDates[index].reason = e.target.value;
                  setSpecialDates(newDates);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deleteSpecialDate(special.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSpecialDate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Data Especial
          </Button>
        </CardContent>
      </Card>

      {/* Fechamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Fechamentos Extraordinários</CardTitle>
          <CardDescription>
            Registre datas em que o restaurante estará fechado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {closures.map((closure, index) => (
            <div key={closure.id || index} className="grid grid-cols-3 gap-2 items-center">
              <Input
                type="date"
                value={closure.date}
                onChange={(e) => {
                  const newClosures = [...closures];
                  newClosures[index].date = e.target.value;
                  setClosures(newClosures);
                }}
              />
              <Input
                placeholder="Motivo do fechamento"
                value={closure.reason}
                onChange={(e) => {
                  const newClosures = [...closures];
                  newClosures[index].reason = e.target.value;
                  setClosures(newClosures);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deleteClosure(closure.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addClosure}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Fechamento
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
