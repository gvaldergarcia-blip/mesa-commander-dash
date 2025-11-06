# Sistema de Reservas - MesaClik Painel

## 📋 Visão Geral

Este documento descreve o sistema de reservas do painel administrativo MesaClik, incluindo fontes de dados, campos exibidos, filtros disponíveis e dependências.

## 🗄️ Fonte de Dados

### View Principal: `mesaclik.v_reservations`

A tela de Reservas consome dados da view `mesaclik.v_reservations`, que une informações de duas tabelas:

- **`mesaclik.reservations`**: Tabela principal com dados das reservas
- **`public.profiles`**: Tabela de perfis de usuário (join para obter email)

### Campos Retornados pela View

| Campo | Origem | Descrição |
|-------|--------|-----------|
| `reservation_id` | reservations.id | ID único da reserva |
| `restaurant_id` | reservations | ID do restaurante |
| `customer_name` | reservations.name | Nome do cliente |
| `phone` | reservations | Telefone do cliente |
| `customer_email` | profiles.email | Email do cliente (via JOIN) |
| `people` | reservations.party_size | Quantidade de pessoas |
| `starts_at` | reservations.reserved_for | Data/hora da reserva (UTC) |
| `status` | reservations | Status da reserva (enum) |
| `notes` | reservations | Observações especiais |
| `created_at` | reservations | Data de criação |
| `updated_at` | reservations | Data de atualização |
| `confirmed_at` | reservations | Data de confirmação |
| `completed_at` | reservations | Data de conclusão |
| `canceled_at` | reservations | Data de cancelamento |
| `no_show_at` | reservations | Data de não comparecimento |
| `canceled_by` | reservations | Quem cancelou (admin/user) |
| `cancel_reason` | reservations | Motivo do cancelamento |

### Status Disponíveis

A coluna `status` usa o enum `mesaclik.reservation_status` com os seguintes valores:

- `pending` - Pendente de confirmação
- `confirmed` - Confirmada pelo restaurante
- `seated` - Cliente já sentado (em atendimento)
- `completed` - Reserva concluída
- `canceled` - Cancelada
- `no_show` - Cliente não compareceu

## 🖥️ Interface do Painel

### Abas Disponíveis

1. **Todas**: Lista todas as reservas com filtros completos
2. **Hoje**: Reservas agendadas para hoje
3. **Esta Semana**: Reservas dos próximos 7 dias
4. **Calendário**: Gerenciamento de disponibilidade do restaurante

### Campos Exibidos na Lista

Para cada reserva, são exibidos:

- **Ícone de calendário** com horário
- **Nome do cliente**
- **Badge de status** (colorido conforme o status)
- **Telefone** (com ícone)
- **Email** (com ícone, se disponível)
- **Quantidade de pessoas** (com ícone)
- **Data e hora** da reserva
- **Observações** (se houver)
- **Botões de ação** (conforme o status)

### Ações por Status

#### Status: Pending
- ✅ **Confirmar** → muda para `confirmed`
- ❌ **Cancelar** → muda para `canceled`

#### Status: Confirmed
- ✅ **Concluir** → muda para `completed`
- ⏸️ **Pendente** → volta para `pending`
- 👻 **Não compareceu** → muda para `no_show`

#### Status: Seated
- ✅ **Concluída** → muda para `completed`
- ❌ **Cancelar** → muda para `canceled`

## 🔍 Filtros Disponíveis

### 1. Filtro de Período
Controla o intervalo de tempo das reservas exibidas:

- **Todas**: Sem filtro de data
- **Hoje**: Apenas reservas de hoje
- **Esta semana**: Próximos 7 dias
- **Últimos 7 dias**: Semana passada
- **Últimos 30 dias**: Último mês
- **Personalizado**: Escolher data início e fim

### 2. Busca por Texto
Campo de busca que procura em:
- Nome do cliente (case-insensitive)
- Telefone
- Email (quando disponível)

### 3. Filtro de Status
Dropdown para filtrar por:
- Todos os status
- Pendentes
- Confirmadas
- Sentadas
- Concluídas
- Canceladas

### 4. Filtro de Tamanho do Grupo
Dropdown para filtrar por quantidade de pessoas:
- Todos os tamanhos
- 1-2 pessoas
- 3-4 pessoas
- 5-6 pessoas
- 7+ pessoas

## ⚡ Atualização em Tempo Real

O painel utiliza **Supabase Realtime** para atualizar automaticamente a lista quando:

- Uma nova reserva é criada (pelo app ou painel)
- O status de uma reserva é atualizado
- Uma reserva é cancelada
- Qualquer modificação na tabela `mesaclik.reservations`

### Implementação
```typescript
// src/hooks/useReservationsRealtime.ts
useEffect(() => {
  const channel = supabase
    .channel('reservations-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'mesaclik',
        table: 'reservations',
        filter: `restaurant_id=eq.${RESTAURANT_ID}`
      },
      () => {
        onUpdate(); // Recarrega as reservas
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [onUpdate]);
```

## 📊 Métricas Exibidas

No topo da tela, cards com estatísticas baseadas no período filtrado:

1. **Total Reservas**: Quantidade total de reservas
2. **Confirmadas**: Quantidade de reservas confirmadas
3. **Pendentes**: Quantidade aguardando confirmação
4. **Total Pessoas**: Soma de todos os convidados

## 🔧 Dependências

### View do Banco de Dados
```sql
-- mesaclik.v_reservations
CREATE OR REPLACE VIEW mesaclik.v_reservations AS
SELECT 
  r.id                AS reservation_id,
  r.restaurant_id,
  r.user_id,
  r.name              AS customer_name,
  r.phone,
  r.party_size        AS people,
  r.reserved_for      AS starts_at,
  r.status,
  r.notes,
  r.created_at,
  r.updated_at,
  r.confirmed_at,
  r.completed_at,
  r.canceled_at,
  r.no_show_at,
  r.canceled_by,
  r.cancel_reason,
  p.email             AS customer_email
FROM mesaclik.reservations r
LEFT JOIN public.profiles p ON p.id = r.user_id;
```

### Hooks Utilizados
- `useReservations()`: CRUD de reservas e estado
- `useReservationsRealtime()`: Atualização em tempo real
- `useRestaurantCalendar()`: Gerenciamento de disponibilidade

### Validações
- Schema Zod em `src/lib/validations/reservation.ts`
- Validação de data futura
- Validação de formato de telefone
- Normalização para UTC

## 🔄 Integração Bidirecional

### App → Painel
✅ Reservas criadas no app Flutter aparecem automaticamente no painel via realtime

### Painel → App
✅ Alterações de status no painel refletem imediatamente no app

### Sincronização
- **Latência**: < 2 segundos (realtime)
- **Schema**: `mesaclik` (compartilhado)
- **Broadcast**: Supabase Realtime

## 🐛 Troubleshooting

### Reservas não aparecem
1. Verificar se `restaurant_id` está correto
2. Confirmar que a view `mesaclik.v_reservations` existe
3. Checar políticas RLS da tabela `mesaclik.reservations`

### Email não aparece
- Email vem da tabela `public.profiles` via `user_id`
- Se o usuário não tem perfil criado, email será `null`
- Verificar se o JOIN está funcionando na view

### Realtime não funciona
1. Confirmar assinatura do canal no console
2. Verificar filtro de `restaurant_id`
3. Checar permissões de broadcast no Supabase

### Filtros não funcionam
- Filtros são aplicados client-side em `applyFilters()`
- Verificar se os dados estão sendo carregados corretamente
- Conferir se o campo `starts_at` está no formato UTC

## 📝 Como Ajustar

### Adicionar novo campo na view
```sql
-- 1. Alterar a view
CREATE OR REPLACE VIEW mesaclik.v_reservations AS
SELECT 
  -- ... campos existentes
  r.novo_campo
FROM mesaclik.reservations r
LEFT JOIN public.profiles p ON p.id = r.user_id;

-- 2. Atualizar tipo TypeScript em src/hooks/useReservations.ts
type Reservation = {
  // ... campos existentes
  novo_campo: string;
};

-- 3. Exibir na interface src/pages/Reservations.tsx
```

### Adicionar novo status
```sql
-- 1. Alterar enum no banco
ALTER TYPE mesaclik.reservation_status ADD VALUE 'novo_status';

-- 2. Adicionar em StatusBadge (src/components/ui/status-badge.tsx)
-- 3. Adicionar lógica de botões em Reservations.tsx
```

### Mudar nome de coluna
Se alguma coluna da tabela `mesaclik.reservations` mudar de nome:
1. Atualizar a view `mesaclik.v_reservations`
2. Manter os aliases (AS) para não quebrar o código
3. Testar criação e listagem de reservas

## 📞 Suporte

Para dúvidas ou problemas, consultar:
- Documentação do Supabase Realtime
- Schema do banco em `supabase/migrations/`
- Logs de auditoria em `src/lib/audit.ts`
