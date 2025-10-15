# Integração do Calendário de Disponibilidade com o App do Cliente

## Problema Identificado
Você bloqueou o dia 18 no painel administrativo, mas o app do cliente ainda está mostrando todos os dias disponíveis.

## Solução

### 1. No App do Cliente (React Native/Web)

Adicione este hook para buscar os dias bloqueados:

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
  }, [restaurantId]);

  const isDateBlocked = (date: Date): boolean => {
    const dateString = date.toISOString().split('T')[0];
    return blockedDates.includes(dateString);
  };

  return { blockedDates, loading, isDateBlocked };
}
```

### 2. Use no Componente de Seleção de Data

```typescript
import { useRestaurantAvailability } from './useRestaurantAvailability';

function ReservationForm() {
  const { isDateBlocked } = useRestaurantAvailability('4c3e1a93-7d9f-4cf2-8e15-9d8c6a5b4e72');
  
  return (
    <DatePicker
      // ... outras props
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

## Configuração Supabase

✅ A tabela `mesaclik.restaurant_calendar` já existe
✅ RLS configurado para permitir leitura pública (necessário para o app)
✅ Constraint única para evitar duplicatas
✅ Index criado para melhor performance

## Estrutura da Tabela

```sql
mesaclik.restaurant_calendar
- restaurant_id (uuid)
- day (date) -- formato: YYYY-MM-DD
- is_open (boolean) -- false = bloqueado, true = disponível
- created_at (timestamptz)
- updated_at (timestamptz)
```

## Teste

1. No painel admin, clique em um dia para bloquear (fica vermelho)
2. Os dados são salvos na tabela com `is_open = false`
3. No app do cliente, o hook `useRestaurantAvailability` busca esses dias
4. O calendário de seleção desabilita automaticamente os dias bloqueados

## Exemplo de Query Manual

Para verificar os dias bloqueados:

```sql
SELECT day, is_open 
FROM mesaclik.restaurant_calendar 
WHERE restaurant_id = '4c3e1a93-7d9f-4cf2-8e15-9d8c6a5b4e72'
AND is_open = false
ORDER BY day;
```
