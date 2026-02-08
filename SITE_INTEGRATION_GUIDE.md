# Guia de Integração: Site Institucional → Painel MesaClik

Este documento descreve os requisitos técnicos para conectar o site institucional ao painel administrativo MesaClik.

---

## 🔑 Configuração Supabase

### Projeto Supabase (OBRIGATÓRIO)
Ambos os projetos devem usar o **mesmo projeto Supabase**:

```
Project ID: akqldesakmcroydbgkbe
URL: https://akqldesakmcroydbgkbe.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrcWxkZXNha21jcm95ZGJna2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNzU5MzMsImV4cCI6MjA3MDk1MTkzM30.z9-eadw-xSeHgnqUUO5BMm2vVkabfY3p41Yb9CGPXIM
```

### URLs de Redirect (Configurar no Supabase Dashboard)
Em `Authentication > URL Configuration > Redirect URLs`, adicionar:
- URL do site institucional (ex: `https://mesaclik.com.br`)
- URL do painel (ex: `https://painel.mesaclik.com.br` ou URL Lovable)

---

## 📊 Tabelas Envolvidas

### 1. `auth.users` (Supabase Auth - Automático)
Criado automaticamente pelo Supabase Auth durante signup.

### 2. `mesaclik.restaurants` (Dados do Restaurante)
```sql
-- Schema: mesaclik
-- Tabela principal do restaurante

CREATE TABLE mesaclik.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cuisine cuisine_enum NOT NULL DEFAULT 'Outros',
  address TEXT,
  address_line TEXT,
  city TEXT,
  owner_id UUID,  -- ID do usuário dono
  about TEXT,
  image_url TEXT,
  menu_url TEXT,
  has_queue BOOLEAN DEFAULT true,
  has_reservation BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Campos obrigatórios no cadastro:**
- `name` - Nome do restaurante
- `cuisine` - Tipo de culinária (enum)
- `owner_id` - UUID do usuário autenticado

### 3. `public.restaurant_members` (Vínculo Usuário-Restaurante)
```sql
-- Esta tabela é CRÍTICA para o funcionamento do painel
-- O painel usa esta tabela para determinar qual restaurante o usuário pode acessar

CREATE TABLE public.restaurant_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  role TEXT DEFAULT 'owner',  -- 'owner', 'manager', 'staff'
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);
```

### 4. `public.user_roles` (Roles de Sistema - Opcional)
```sql
-- Para admins do sistema MesaClik (não restaurantes)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',  -- 'admin', 'moderator', 'user'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);
```

---

## 🔄 Fluxo de Cadastro de Restaurante

### Passo 1: Criar Usuário (Supabase Auth)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Signup do usuário
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: 'dono@restaurante.com',
  password: 'senha123',
  options: {
    emailRedirectTo: 'https://site.com/confirmacao'
  }
});

if (authError) throw authError;
const userId = authData.user?.id;
```

### Passo 2: Criar Restaurante
```typescript
// Após confirmação do email ou imediatamente (dependendo da config)
const { data: restaurant, error: restaurantError } = await supabase
  .schema('mesaclik')
  .from('restaurants')
  .insert({
    name: 'Nome do Restaurante',
    cuisine: 'Brasileira',  // Enum válido
    address: 'Rua Example, 123',
    city: 'São Paulo',
    owner_id: userId
  })
  .select()
  .single();

if (restaurantError) throw restaurantError;
```

### Passo 3: Vincular Usuário ao Restaurante (CRÍTICO!)
```typescript
// SEM ISSO, O PAINEL NÃO FUNCIONARÁ!
const { error: memberError } = await supabase
  .from('restaurant_members')
  .insert({
    user_id: userId,
    restaurant_id: restaurant.id,
    role: 'owner'
  });

if (memberError) throw memberError;
```

### Passo 4: Criar Configurações Padrão
```typescript
// Queue (Fila)
await supabase.schema('mesaclik').from('queues').insert({
  restaurant_id: restaurant.id,
  name: 'Fila Principal',
  is_active: true
});

// Queue Settings
await supabase.from('queue_settings').insert({
  restaurant_id: restaurant.id,
  queue_capacity: 50,
  max_party_size: 10,
  tolerance_minutes: 15,
  avg_time_1_2: 15,
  avg_time_3_4: 20,
  avg_time_5_6: 25,
  avg_time_7_8: 30
});

// Reservation Settings
await supabase.from('reservation_settings').insert({
  restaurant_id: restaurant.id,
  max_party_size: 20,
  tolerance_minutes: 15
});

// Restaurant Hours (exemplo: Seg-Dom 11h-23h)
const days = [0, 1, 2, 3, 4, 5, 6]; // Dom-Sab
for (const day of days) {
  await supabase.from('restaurant_hours').insert({
    restaurant_id: restaurant.id,
    day_of_week: day,
    open_time: '11:00',
    close_time: '23:00'
  });
}
```

### Passo 5: Redirecionar para o Painel
```typescript
// Após cadastro completo, redirecionar
window.location.href = 'https://painel.mesaclik.com.br';
// O painel automaticamente detectará a sessão e carregará o restaurante
```

---

## 🔐 Fluxo de Login

```typescript
// Login simples
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'dono@restaurante.com',
  password: 'senha123'
});

if (error) {
  // Tratar erro (credenciais inválidas, email não confirmado, etc.)
  throw error;
}

// Sucesso - redirecionar para o painel
window.location.href = 'https://painel.mesaclik.com.br';
```

---

## 📋 Enums Disponíveis

### `cuisine_enum` (Tipos de Culinária)
```sql
-- Valores válidos para o campo 'cuisine':
'Brasileira', 'Italiana', 'Japonesa', 'Mexicana', 'Francesa', 
'Chinesa', 'Árabe', 'Indiana', 'Peruana', 'Tailandesa',
'Coreana', 'Portuguesa', 'Espanhola', 'Americana', 'Contemporânea',
'Vegana', 'Vegetariana', 'Frutos do Mar', 'Churrascaria', 
'Pizzaria', 'Hamburgueria', 'Cafeteria', 'Padaria', 'Outros'
```

---

## ✅ Checklist de Integração

### No Site Institucional:
- [ ] Conectar ao mesmo projeto Supabase
- [ ] Implementar formulário de signup/login
- [ ] Criar restaurante em `mesaclik.restaurants`
- [ ] **CRÍTICO**: Criar entrada em `restaurant_members`
- [ ] Criar configurações padrão (queue_settings, etc.)
- [ ] Configurar redirect para o painel

### No Supabase Dashboard:
- [ ] Adicionar URLs de redirect em Authentication
- [ ] Verificar se RLS policies estão ativas
- [ ] (Opcional) Desabilitar "Confirm email" para testes

### No Painel (Já Implementado ✅):
- [x] `RestaurantContext` busca via `restaurant_members`
- [x] `ProtectedRoute` valida sessão
- [x] Todos os hooks usam `restaurantId` dinâmico
- [x] RLS policies por restaurante

---

## 🔧 Função Helper Sugerida

```typescript
// utils/createRestaurant.ts
import { supabase } from '@/integrations/supabase/client';

interface CreateRestaurantData {
  name: string;
  cuisine: string;
  address?: string;
  city?: string;
}

export async function createRestaurantWithSetup(
  userId: string, 
  data: CreateRestaurantData
) {
  // 1. Criar restaurante
  const { data: restaurant, error: restError } = await supabase
    .schema('mesaclik')
    .from('restaurants')
    .insert({
      ...data,
      owner_id: userId
    })
    .select()
    .single();

  if (restError) throw restError;

  // 2. Vincular usuário
  const { error: memberError } = await supabase
    .from('restaurant_members')
    .insert({
      user_id: userId,
      restaurant_id: restaurant.id,
      role: 'owner'
    });

  if (memberError) throw memberError;

  // 3. Criar fila
  await supabase.schema('mesaclik').from('queues').insert({
    restaurant_id: restaurant.id,
    name: 'Fila Principal',
    is_active: true
  });

  // 4. Configurações padrão
  await Promise.all([
    supabase.from('queue_settings').insert({
      restaurant_id: restaurant.id,
      queue_capacity: 50,
      max_party_size: 10,
      tolerance_minutes: 15
    }),
    supabase.from('reservation_settings').insert({
      restaurant_id: restaurant.id,
      max_party_size: 20,
      tolerance_minutes: 15
    })
  ]);

  return restaurant;
}
```

---

## 🚨 Erros Comuns

### "Nenhum restaurante associado"
**Causa**: Usuário não tem entrada em `restaurant_members`
**Solução**: Verificar se o INSERT em `restaurant_members` foi executado

### "Erro ao carregar restaurante"
**Causa**: RLS bloqueando acesso ou restaurante não existe
**Solução**: Verificar se `restaurants.id` existe e RLS permite acesso

### Sessão não compartilhada entre sites
**Causa**: Diferentes projetos Supabase ou cookies bloqueados
**Solução**: Usar exatamente o mesmo `SUPABASE_URL` e `SUPABASE_ANON_KEY`

---

## 📞 Suporte

Para dúvidas técnicas sobre a integração, consulte:
- Este documento
- Código do `RestaurantContext.tsx` neste projeto
- Supabase Dashboard para verificar dados

---

*Documento gerado para integração MesaClik v1.0*
*Última atualização: Fevereiro 2026*
