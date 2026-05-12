## Objetivo

Tornar o **Cardápio Inteligente** um agente conversacional que aprende o prato predileto de cada cliente e dispara, em horário agendado, uma imagem personalizada (gerada pela IA ou foto do prato com overlay) por **WhatsApp/SMS via Twilio MMS** — tudo a 1 clique a partir do chat.

---

## 1. Banco de dados (nova migration)

**`menu_customer_preferences`** — prato predileto por cliente
- `customer_id` (FK restaurant_customers), `dish_id` (FK menu_dishes), `restaurant_id`
- `score` int (peso do palpite), `source` text ('ia_chat' | 'manual' | 'visit_pattern')
- unique(customer_id, dish_id)

**`menu_dish_campaigns`** — fila de envios agendados
- `restaurant_id`, `customer_id`, `dish_id`
- `phone` text (E.164), `message` text, `image_url` text
- `scheduled_at` timestamptz, `status` text ('pending'|'sent'|'failed'|'canceled')
- `sent_at`, `twilio_sid`, `error`, `created_by`

**RPCs SECURITY DEFINER** (validam `is_member_or_admin`):
- `set_customer_favorite_dish(p_customer_id, p_dish_id, p_source)`
- `schedule_dish_campaign(p_customer_id, p_dish_id, p_message, p_image_url, p_scheduled_at)`
- `cancel_dish_campaign(p_id)`

Índice em `(status, scheduled_at)` para o cron.

---

## 2. Edge functions

**`cardapio-chat`** (streaming, AI SDK + Lovable AI Gateway, modelo `google/gemini-3-flash-preview`)
- Tools expostas ao agente:
  - `list_customers({ search? })` — top 30 clientes do restaurante (nome, visitas, VIP, último prato)
  - `list_dishes({ search? })` — pratos do `menu_dishes`
  - `set_favorite_dish({ customer_id, dish_id })` → chama RPC
  - `generate_personalized_image({ dish_id, customer_name, headline })` → chama `generate-dish-image`
  - `schedule_campaign({ customer_id, dish_id, message, image_url, scheduled_at })` → RPC
  - `send_now({ customer_id, dish_id, message, image_url })` → invoca `dispatch-dish-campaigns` direto
- Valida JWT, escopo por restaurante via `useRestaurantContext` no client.

**`generate-dish-image`** — usa Gemini `google/gemini-2.5-flash-image` (Nano Banana) via Lovable AI Gateway.
- Input: foto do prato OU descrição → gera banner com nome do cliente + headline.
- Salva no bucket `dish-photos/{restaurant_id}/campaigns/`, retorna URL pública.

**`dispatch-dish-campaigns`** — cron a cada minuto via `pg_cron + pg_net`.
- Pega `pending` com `scheduled_at <= now()`, dispara via Twilio gateway (`/Messages.json` com `MediaUrl`).
- Atualiza status, `twilio_sid`, `sent_at`. Registra visita opcional no CRM.

---

## 3. Frontend (`src/pages/CardapioInteligente.tsx`)

Nova aba **"Chat IA"** (além das já existentes Pratos/Insights):

**Composição AI Elements** (`bun x ai-elements@latest add conversation message prompt-input shimmer tool`)
- `Conversation` + `MessageResponse` para markdown streaming
- `Tool` accordion fechado mostrando: clientes consultados, prato escolhido, prévia da imagem gerada
- `PromptInput` + footer com submit

Hook `useCardapioChat` — `useChat` apontando para `/cardapio-chat`, persistência **localStorage** (uma conversa só, conforme contrato chat-agent-ui-contract — sem threads).

Nova aba **"Agenda"**: lista `menu_dish_campaigns` pendentes/enviadas com botão cancelar.

Sem `Sparkles` como logo — uso `ChefHat` + foto real do prato como avatar do assistente.

---

## 4. Conector & secrets

- **Twilio** já está conectado (consta em integrações existentes do MesaClik). Reuso `TWILIO_API_KEY`.
- **LOVABLE_API_KEY** já presente.
- Bucket `dish-photos` já criado na migration anterior — adiciono subpasta `campaigns/`.

---

## 5. Cron

```sql
select cron.schedule(
  'dispatch-dish-campaigns', '* * * * *',
  $$ select net.http_post(
    url:='https://akqldesakmcroydbgkbe.supabase.co/functions/v1/dispatch-dish-campaigns',
    headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);
```

---

## 6. Fora de escopo (nesta entrega)

- Chat público para o cliente final do restaurante (você optou só por painel interno integrado).
- Autopilot diário automático (mantemos só manual 1-clique conforme sua resposta).
- Envio por e-mail (somente Twilio MMS conforme escolhido).

---

## Diagrama do fluxo

```text
[Dono no Chat IA]
      │ "envia imagem do nhoque pra Maria amanhã 19h"
      ▼
[cardapio-chat (streamText + tools)]
  ├─ list_customers  → encontra Maria
  ├─ list_dishes     → encontra Nhoque
  ├─ generate_personalized_image → URL no bucket
  └─ schedule_campaign → INSERT menu_dish_campaigns(pending)
      │
      ▼ (cron 1 min)
[dispatch-dish-campaigns] → Twilio /Messages.json (MediaUrl)
      │
      ▼
[Maria recebe SMS/MMS com imagem do prato + texto pessoal]
```
