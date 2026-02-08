# Prompt para o Site Institucional MesaClik

**Copie e cole este prompt no projeto do site institucional:**

---

## PROMPT:

```
Preciso implementar o sistema de cadastro e login de restaurantes que dará acesso ao painel administrativo MesaClik (projeto externo).

## Contexto
- O Supabase já está conectado (mesmo projeto: akqldesakmcroydbgkbe)
- Após cadastro/login, o usuário deve ser redirecionado para: [URL_DO_PAINEL]
- A sessão Supabase é compartilhada automaticamente entre os projetos

## O que precisa ser implementado:

### 1. Página de Cadastro de Restaurante (/cadastro)
Formulário com os campos:
- Nome do restaurante (obrigatório)
- Tipo de culinária (select com opções: Brasileira, Italiana, Japonesa, Mexicana, Churrascaria, Pizzaria, Hamburgueria, Contemporânea, Outros)
- Endereço completo
- Cidade
- Email do proprietário (obrigatório)
- Senha (obrigatório, mínimo 6 caracteres)
- Confirmação de senha

### 2. Fluxo de Cadastro (CRÍTICO - seguir exatamente):

```typescript
// Passo 1: Criar usuário no Supabase Auth
const { data: authData, error } = await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: window.location.origin }
});

// Passo 2: Criar restaurante no schema mesaclik
const { data: restaurant } = await supabase
  .schema('mesaclik')
  .from('restaurants')
  .insert({
    name: nomeRestaurante,
    cuisine: tipoCulinaria, // deve ser um valor válido do enum
    address: endereco,
    city: cidade,
    owner_id: authData.user.id
  })
  .select()
  .single();

// Passo 3: OBRIGATÓRIO - Vincular usuário ao restaurante
await supabase
  .from('restaurant_members')
  .insert({
    user_id: authData.user.id,
    restaurant_id: restaurant.id,
    role: 'owner'
  });

// Passo 4: Criar fila padrão
await supabase
  .schema('mesaclik')
  .from('queues')
  .insert({
    restaurant_id: restaurant.id,
    name: 'Fila Principal',
    is_active: true
  });

// Passo 5: Criar configurações padrão
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

await supabase.from('reservation_settings').insert({
  restaurant_id: restaurant.id,
  max_party_size: 20,
  tolerance_minutes: 15
});

// Passo 6: Redirecionar para o painel
window.location.href = '[URL_DO_PAINEL]';
```

### 3. Página de Login (/login)
- Email e senha
- Após login bem-sucedido, redirecionar para [URL_DO_PAINEL]
- Tratar erros (credenciais inválidas, email não confirmado)

### 4. Validações importantes:
- Email válido
- Senha mínimo 6 caracteres
- Nome do restaurante obrigatório
- Mostrar loading durante operações
- Mostrar mensagens de erro amigáveis

### 5. Enum de culinária válido (cuisine_enum):
'Brasileira', 'Italiana', 'Japonesa', 'Mexicana', 'Francesa', 
'Chinesa', 'Árabe', 'Indiana', 'Peruana', 'Tailandesa',
'Coreana', 'Portuguesa', 'Espanhola', 'Americana', 'Contemporânea',
'Vegana', 'Vegetariana', 'Frutos do Mar', 'Churrascaria', 
'Pizzaria', 'Hamburgueria', 'Cafeteria', 'Padaria', 'Outros'

### 6. Design:
- Seguir o design system existente do site
- Formulário limpo e profissional
- Feedback visual de loading e sucesso/erro

IMPORTANTE: O passo 3 (restaurant_members) é CRÍTICO - sem ele o painel não funcionará!
```

---

## Após implementar, configurar no Supabase Dashboard:

1. Ir em **Authentication > URL Configuration**
2. Em **Redirect URLs**, adicionar:
   - URL do site institucional
   - URL do painel MesaClik

---

## Substituir [URL_DO_PAINEL] por:

Use a URL de preview ou publicada do painel:
- Preview: `https://id-preview--8745614f-4684-4931-9f6e-917b37b60a47.lovable.app`
- Ou a URL publicada/domínio customizado quando tiver

---
