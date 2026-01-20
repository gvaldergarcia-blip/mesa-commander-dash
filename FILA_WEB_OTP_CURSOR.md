# Documentação para Integração - Fila Web com OTP (Cursor)

Este documento descreve a configuração do Supabase para a Fila Web com autenticação OTP por e-mail. Use estas informações para integrar a **Tela de Posição** no app do Cursor.

## 📋 Resumo da Implementação

### Fluxo Completo
```
1. Cliente acessa /fila/entrar?restauranteId=UUID
2. Digita e-mail → recebe OTP por e-mail (Supabase Auth)
3. Redireciona para /fila/verificar → digita código OTP
4. Após verificação → seleciona número de pessoas
5. Entrada criada → redireciona para /fila/final (ou app Cursor)
6. Tela Final mostra posição, status, checkbox de ofertas
```

---

## 🗄️ Tabelas Criadas (Supabase - Schema `public`)

### 1. `fila_entradas`
Entradas na fila vinculadas ao usuário autenticado.

```sql
CREATE TABLE public.fila_entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando' 
    CHECK (status IN ('aguardando', 'chamado', 'finalizado', 'cancelado')),
  party_size integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  finalized_at timestamptz,
  canceled_at timestamptz,
  active boolean NOT NULL DEFAULT true
);
```

**Índices:**
- `(restaurante_id, created_at)` - ordenação da fila
- `(user_id)` - busca por usuário
- `(restaurante_id, status)` - filtro por status
- `(restaurante_id, active) WHERE active = true` - entradas ativas

### 2. `clientes_restaurante`
Relacionamento cliente-restaurante (visitas, histórico).

```sql
CREATE TABLE public.clientes_restaurante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL,
  visitas_concluidas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurante_id, user_id)
);
```

### 3. `consentimentos_cliente`
Preferências de marketing (LGPD).

```sql
CREATE TABLE public.consentimentos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL,
  aceitou_ofertas_email boolean NOT NULL DEFAULT false,
  aceitou_termos_uso boolean NOT NULL DEFAULT false,
  aceitou_politica_privacidade boolean NOT NULL DEFAULT false,
  data_consentimento timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurante_id, user_id)
);
```

---

## 🔧 Funções RPC (Supabase)

### 1. `create_queue_entry_web(p_restaurante_id, p_party_size)`
Cria entrada na fila de forma transacional.

**Parâmetros:**
- `p_restaurante_id` (uuid) - ID do restaurante
- `p_party_size` (integer, default 1) - Número de pessoas

**Retorno (JSONB):**
```json
{
  "success": true,
  "entry_id": "uuid-da-entrada",
  "already_exists": false,
  "message": "Entrada criada com sucesso"
}
```

**Comportamento:**
- Valida restaurante existe
- Se já tem entrada ativa (aguardando/chamado), retorna a existente
- Cria/atualiza registros em `clientes_restaurante` e `consentimentos_cliente`

### 2. `get_my_queue_status(p_restaurante_id)`
Retorna status e posição do usuário na fila.

**Retorno (JSONB):**
```json
{
  "success": true,
  "in_queue": true,
  "entry_id": "uuid",
  "status": "aguardando",
  "position": 3,
  "party_size": 2,
  "created_at": "2024-01-20T10:00:00Z",
  "called_at": null,
  "consent": {
    "aceitou_ofertas_email": false,
    "aceitou_termos_uso": false,
    "aceitou_politica_privacidade": false
  }
}
```

**Cálculo de Posição:**
```sql
-- Conta quantas entradas ativas estão na frente + 1
SELECT COUNT(*) + 1 
FROM fila_entradas
WHERE restaurante_id = ? 
  AND status IN ('aguardando', 'chamado')
  AND active = true
  AND (created_at < entrada_do_usuario.created_at 
       OR (created_at = entrada_do_usuario.created_at AND id < entrada_do_usuario.id))
```

### 3. `update_consent(p_restaurante_id, p_aceitou_ofertas_email, ...)`
Atualiza preferências de marketing.

**Parâmetros (todos opcionais exceto restaurante_id):**
- `p_aceitou_ofertas_email` (boolean)
- `p_aceitou_termos_uso` (boolean)
- `p_aceitou_politica_privacidade` (boolean)

### 4. `cancel_my_queue_entry(p_restaurante_id)`
Permite usuário cancelar sua própria entrada.

---

## 🔐 RLS Policies

### Para Clientes (auth.uid() = user_id)
- SELECT, INSERT, UPDATE próprias entradas
- SELECT, INSERT, UPDATE próprios consentimentos

### Para Donos de Restaurante
- SELECT, UPDATE entradas do seu restaurante
- SELECT clientes e consentimentos do seu restaurante

---

## 📱 Integração com App Cursor

### URL de Acesso à Fila
```
https://seu-dominio.com/fila/entrar?restauranteId=UUID_DO_RESTAURANTE
```

### Exemplo de Chamada RPC (JavaScript/TypeScript)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Buscar status (requer usuário autenticado)
const { data, error } = await supabase.rpc('get_my_queue_status', {
  p_restaurante_id: 'uuid-do-restaurante'
});

if (data?.success && data?.in_queue) {
  console.log('Posição:', data.position);
  console.log('Status:', data.status); // aguardando | chamado | finalizado | cancelado
}
```

### Polling Recomendado
```typescript
// Atualizar a cada 10 segundos
useEffect(() => {
  const interval = setInterval(async () => {
    const { data } = await supabase.rpc('get_my_queue_status', {
      p_restaurante_id: restauranteId
    });
    setQueueStatus(data);
  }, 10000);

  return () => clearInterval(interval);
}, [restauranteId]);
```

### Atualização de Consentimento
```typescript
await supabase.rpc('update_consent', {
  p_restaurante_id: restauranteId,
  p_aceitou_ofertas_email: true
});
```

---

## 🔗 URLs do Lovable (Tela Comando)

- **Entrada:** `/fila/entrar?restauranteId=UUID`
- **Verificação OTP:** `/fila/verificar?restauranteId=UUID&email=EMAIL`
- **Status/Posição:** `/fila/final?restauranteId=UUID`

### Supabase Dashboard
- **Project ID:** `akqldesakmcroydbgkbe`
- **URL:** `https://akqldesakmcroydbgkbe.supabase.co`

---

## ⚙️ Configuração do Supabase Auth

O OTP é enviado via Supabase Auth nativo:

```typescript
// Enviar OTP
await supabase.auth.signInWithOtp({
  email: 'usuario@email.com',
  options: {
    shouldCreateUser: true,
    emailRedirectTo: `${origin}/fila/verificar?restauranteId=${id}&email=${email}`
  }
});

// Verificar OTP
await supabase.auth.verifyOtp({
  email: 'usuario@email.com',
  token: '123456',
  type: 'email'
});
```

---

## 📊 Diagrama de Fluxo

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  /fila/entrar   │────▶│  /fila/verificar │────▶│   /fila/final   │
│  (Input email)  │     │  (Input OTP +    │     │  (Posição +     │
│                 │     │   Party size)    │     │   Consentimento)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
  signInWithOtp()          verifyOtp() +           get_my_queue_status()
                        create_queue_entry_web()   update_consent()
```

---

## 🎯 Próximos Passos (Cursor)

1. **Substituir `/fila/final`** pela tela de posição do app nativo
2. **Manter polling** de `get_my_queue_status` para atualizar posição
3. **Implementar notificações** quando status mudar para "chamado"
4. **Sincronizar** com a tela de operação do restaurante (chamar/finalizar)

---

## 📝 Notas Importantes

- **Autenticação:** Todas as RPCs requerem usuário autenticado via Supabase Auth
- **Posição dinâmica:** Calculada em tempo real, não armazenada
- **Multi-tenant:** Cada restaurante tem sua própria fila isolada
- **LGPD:** Consentimentos salvos por restaurante
