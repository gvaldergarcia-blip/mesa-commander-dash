# Integração do Calendário de Disponibilidade com o App do Cliente

## ✅ O que já está funcionando no Painel Admin

O painel administrativo já possui:
- Aba "Calendário" na página de Reservas
- Função para bloquear/desbloquear dias (clique nos dias para alternar)
- Salvamento automático na tabela `mesaclik.restaurant_calendar`
- Dias bloqueados ficam vermelhos, dias disponíveis ficam verdes

## 📱 Como Integrar no App do Cliente

### 1. Criar o Hook de Disponibilidade

Crie o arquivo `useRestaurantAvailability.ts` no seu app React Native/Web:

```typescript
// useRestaurantAvailability.ts
import { useEffect, useState } from 'react';
import { supabase } from './seu-supabase-client';

export function useRestaurantAvailability(restaurantId: string) {
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlockedDates = async () => {
      try {
        const { data, error } = await supabase
          .schema('mesaclik')
          .from('restaurant_calendar')
          .select('day')
          .eq('restaurant_id', restaurantId)
          .eq('is_open', false); // Dias com is_open = false estão bloqueados

        if (error) throw error;
        
        // Converter para array de strings no formato YYYY-MM-DD
        const dates = (data || []).map(item => item.day);
        setBlockedDates(dates);
      } catch (err) {
        console.error('Erro ao buscar disponibilidade:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockedDates();

    // Configurar realtime para atualizar automaticamente
    const channel = supabase
      .channel('calendar-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'restaurant_calendar',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        () => {
          // Quando houver mudanças, recarregar os dados
          fetchBlockedDates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const isDateBlocked = (date: Date): boolean => {
    const dateString = date.toISOString().split('T')[0];
    return blockedDates.includes(dateString);
  };

  return { blockedDates, loading, isDateBlocked };
}
```

### 2. Usar no Componente de Seleção de Data

**Exemplo com React Native Calendars:**

```typescript
import { Calendar } from 'react-native-calendars';
import { useRestaurantAvailability } from './useRestaurantAvailability';

function ReservationForm() {
  const { isDateBlocked, blockedDates } = useRestaurantAvailability(
    '4c3e1a93-7d9f-4cf2-8e15-9d8c6a5b4e72'
  );
  
  // Criar objeto de datas desabilitadas para o calendário
  const markedDates = {};
  blockedDates.forEach(date => {
    markedDates[date] = {
      disabled: true,
      disableTouchEvent: true,
      marked: true,
      dotColor: 'red',
    };
  });
  
  return (
    <Calendar
      markedDates={markedDates}
      onDayPress={(day) => {
        if (!isDateBlocked(new Date(day.dateString))) {
          // Permitir seleção apenas de dias não bloqueados
          console.log('Data selecionada:', day.dateString);
        }
      }}
    />
  );
}
```

**Exemplo com Shadcn Calendar (React Web):**

```typescript
import { Calendar } from '@/components/ui/calendar';
import { useRestaurantAvailability } from './useRestaurantAvailability';

function ReservationForm() {
  const [date, setDate] = useState<Date>();
  const { isDateBlocked } = useRestaurantAvailability(
    '4c3e1a93-7d9f-4cf2-8e15-9d8c6a5b4e72'
  );
  
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      disabled={(date) => {
        // Desabilitar datas passadas
        if (date < new Date()) return true;
        
        // Desabilitar dias bloqueados pelo restaurante
        if (isDateBlocked(date)) return true;
        
        return false;
      }}
    />
  );
}
```

### 3. Estrutura da Tabela

```sql
mesaclik.restaurant_calendar
- restaurant_id (uuid) - ID do restaurante
- day (date) - Data no formato YYYY-MM-DD
- is_open (boolean) - false = bloqueado, true = disponível
- created_at (timestamptz)
- updated_at (timestamptz)
```

## 🔄 Como Funciona

1. **No Painel Admin:**
   - Administrador clica em um dia no calendário
   - Sistema salva na tabela com `is_open = false` (bloqueado) ou `is_open = true` (disponível)
   
2. **No App do Cliente:**
   - Hook busca todos os dias com `is_open = false`
   - Calendário desabilita automaticamente esses dias
   - Realtime atualiza instantaneamente quando o admin faz mudanças

3. **Atualização em Tempo Real:**
   - Usando Supabase Realtime, o app do cliente recebe notificações quando o admin bloqueia/desbloqueia dias
   - Não é necessário recarregar o app

## ✅ Checklist de Integração

- [ ] Criar o hook `useRestaurantAvailability` no app do cliente
- [ ] Integrar com o componente de seleção de data
- [ ] Testar bloqueio de um dia no painel admin
- [ ] Verificar se o dia aparece bloqueado no app do cliente
- [ ] Testar atualização em tempo real (app aberto enquanto admin faz mudanças)

## 🧪 Como Testar

1. Abra o painel admin em `/reservations`
2. Vá para a aba "Calendário"
3. Clique em um dia futuro para bloqueá-lo (deve ficar vermelho)
4. No app do cliente, tente criar uma reserva
5. O dia bloqueado deve aparecer desabilitado/cinza
6. Com o app aberto, desbloqueie o dia no admin
7. O app deve atualizar automaticamente (sem recarregar)

## 📊 Verificar Dados Manualmente

Para ver os dias bloqueados no banco:

```sql
SELECT day, is_open 
FROM mesaclik.restaurant_calendar 
WHERE restaurant_id = '4c3e1a93-7d9f-4cf2-8e15-9d8c6a5b4e72'
ORDER BY day;
```

## 🔐 Segurança (RLS)

A tabela `restaurant_calendar` já possui políticas RLS configuradas:
- ✅ Leitura pública (necessário para o app cliente)
- ✅ Escrita apenas para o dono do restaurante
- ✅ Constraint única para evitar duplicatas (restaurant_id + day)
