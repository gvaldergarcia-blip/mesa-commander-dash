# Prompt para Cursor: Integração de Email com Fila Web

## Contexto

O sistema Lovable criou toda a infraestrutura de fila web com autenticação por email OTP. Agora o Cursor precisa integrar o envio de emails para notificar os clientes sobre sua posição na fila.

---

## Estrutura do Supabase Existente

### Projeto Supabase
- **Project ID**: `akqldesakmcroydbgkbe`
- **URL**: `https://akqldesakmcroydbgkbe.supabase.co`

### Tabelas Principais (schema: public)

#### `fila_entradas`
```sql
-- Entradas na fila de espera web
CREATE TABLE public.fila_entradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- auth.uid() do cliente
  email TEXT NOT NULL,
  restaurante_id UUID NOT NULL REFERENCES restaurants(id),
  party_size INTEGER DEFAULT 2,
  status TEXT DEFAULT 'aguardando', -- aguardando | chamado | finalizado | cancelado
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  called_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ
);
```

#### `clientes_restaurante`
```sql
-- Histórico de visitas do cliente por restaurante
CREATE TABLE public.clientes_restaurante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  restaurante_id UUID NOT NULL REFERENCES restaurants(id),
  visitas_concluidas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `consentimentos_cliente`
```sql
-- Consentimentos LGPD
CREATE TABLE public.consentimentos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  restaurante_id UUID NOT NULL REFERENCES restaurants(id),
  aceitou_ofertas_email BOOLEAN DEFAULT false,
  aceitou_termos_uso BOOLEAN DEFAULT false,
  aceitou_politica_privacidade BOOLEAN DEFAULT false,
  data_consentimento TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## RPCs Disponíveis

### 1. `get_my_queue_status(p_restaurante_id UUID)`
Retorna o status atual do usuário logado na fila.

```typescript
const { data, error } = await supabase.rpc('get_my_queue_status', {
  p_restaurante_id: 'UUID_DO_RESTAURANTE'
});

// Retorno:
{
  "found": true,
  "entry_id": "uuid",
  "status": "aguardando",
  "party_size": 4,
  "position": 3,
  "created_at": "2025-01-20T10:00:00Z"
}
```

### 2. `create_queue_entry_web(p_restaurante_id UUID, p_party_size INTEGER)`
Cria uma entrada na fila para o usuário logado.

```typescript
const { data, error } = await supabase.rpc('create_queue_entry_web', {
  p_restaurante_id: 'UUID_DO_RESTAURANTE',
  p_party_size: 4
});

// Retorno:
{
  "success": true,
  "entry_id": "uuid",
  "position": 5,
  "message": "Você entrou na fila!"
}
```

### 3. `cancel_my_queue_entry(p_restaurante_id UUID)`
Cancela a entrada ativa do usuário na fila.

```typescript
const { data, error } = await supabase.rpc('cancel_my_queue_entry', {
  p_restaurante_id: 'UUID_DO_RESTAURANTE'
});
```

### 4. `update_consent(p_restaurante_id, p_aceitou_ofertas_email, p_aceitou_termos_uso, p_aceitou_politica_privacidade)`
Atualiza os consentimentos LGPD do cliente.

---

## Tarefa para o Cursor

### Objetivo
Criar uma Edge Function que envia um email ao cliente com sua posição na fila sempre que:
1. Cliente entra na fila (via `create_queue_entry_web`)
2. Cliente é chamado (status muda para `chamado`)
3. Posição do cliente muda significativamente

### Edge Function: `send-queue-email`

```typescript
// supabase/functions/send-queue-email/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueueEmailRequest {
  email: string;
  customer_name?: string;
  restaurant_name: string;
  position: number;
  estimated_wait_minutes?: number;
  type: 'entry' | 'called' | 'position_update';
  queue_url?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      customer_name,
      restaurant_name, 
      position, 
      estimated_wait_minutes,
      type,
      queue_url 
    }: QueueEmailRequest = await req.json();

    let subject = "";
    let html = "";

    switch (type) {
      case 'entry':
        subject = `✅ Você entrou na fila - ${restaurant_name}`;
        html = `
          <h1>Olá${customer_name ? `, ${customer_name}` : ''}!</h1>
          <p>Você entrou na fila do <strong>${restaurant_name}</strong>.</p>
          <p>Sua posição atual: <strong>#${position}</strong></p>
          ${estimated_wait_minutes ? `<p>Tempo estimado: ~${estimated_wait_minutes} minutos</p>` : ''}
          ${queue_url ? `<p><a href="${queue_url}">Acompanhe sua posição em tempo real</a></p>` : ''}
          <p>Você receberá um email quando for chamado!</p>
        `;
        break;

      case 'called':
        subject = `🔔 SUA VEZ CHEGOU - ${restaurant_name}`;
        html = `
          <h1>É a sua vez!</h1>
          <p>O <strong>${restaurant_name}</strong> está chamando você!</p>
          <p>Por favor, dirija-se à recepção.</p>
          <p style="color: red; font-weight: bold;">Você tem 10 minutos para comparecer.</p>
        `;
        break;

      case 'position_update':
        subject = `📍 Atualização da fila - ${restaurant_name}`;
        html = `
          <h1>Sua posição foi atualizada!</h1>
          <p>Posição atual: <strong>#${position}</strong></p>
          ${estimated_wait_minutes ? `<p>Tempo estimado: ~${estimated_wait_minutes} minutos</p>` : ''}
          ${queue_url ? `<p><a href="${queue_url}">Ver fila em tempo real</a></p>` : ''}
        `;
        break;
    }

    const emailResponse = await resend.emails.send({
      from: "Fila Digital <fila@seudominio.com>",
      to: [email],
      subject,
      html,
    });

    console.log("Email enviado:", emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Erro ao enviar email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
```

### Trigger no Banco (opcional - para automação)

```sql
-- Trigger para enviar email quando status muda para 'chamado'
CREATE OR REPLACE FUNCTION notify_queue_called()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'chamado' AND OLD.status = 'aguardando' THEN
    -- Chamar edge function via pg_net ou webhook
    PERFORM net.http_post(
      url := 'https://akqldesakmcroydbgkbe.supabase.co/functions/v1/send-queue-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'email', NEW.email,
        'restaurant_name', (SELECT name FROM restaurants WHERE id = NEW.restaurante_id),
        'position', 0,
        'type', 'called'
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_queue_status_change
  AFTER UPDATE ON fila_entradas
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_queue_called();
```

---

## Secrets Necessários

No Supabase Dashboard → Settings → Edge Functions → Secrets:

| Nome | Descrição |
|------|-----------|
| `RESEND_API_KEY` | API key do Resend.com para envio de emails |

---

## Fluxo Completo

1. **Cliente entra na fila** (web/app)
   - `create_queue_entry_web()` é chamado
   - Edge function `send-queue-email` envia email de confirmação

2. **Restaurante chama cliente** (painel admin)
   - Status muda para `chamado`
   - Trigger envia email automático

3. **Cliente acompanha posição** (app Cursor)
   - Usa `get_my_queue_status()` para polling
   - Exibe posição em tempo real

---

## URLs do Sistema Lovable

- **Entrar na fila**: `/fila/entrar?restauranteId=UUID`
- **Verificar OTP**: `/fila/verificar`
- **Status da fila**: `/fila/final`

---

## Exemplo de Chamada da Edge Function

```typescript
// No Cursor, após cliente entrar na fila:
const { data: queueData } = await supabase.rpc('create_queue_entry_web', {
  p_restaurante_id: restaurantId,
  p_party_size: partySize
});

if (queueData?.success) {
  // Enviar email de confirmação
  await supabase.functions.invoke('send-queue-email', {
    body: {
      email: userEmail,
      restaurant_name: 'Nome do Restaurante',
      position: queueData.position,
      type: 'entry',
      queue_url: `https://app.cursor.com/fila?id=${queueData.entry_id}`
    }
  });
}
```
