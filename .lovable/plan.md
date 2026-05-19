## Objetivo
Chatbot WhatsApp por restaurante: dono conecta o número WhatsApp dele (Twilio), e a IA conversa com cada cliente final entendendo histórico (visitas, prato favorito, VIP) e dispara imagens dos pratos reais com overlay personalizado ("Maria, seu nhoque te espera").

---

## 1. Conexão WhatsApp por restaurante

Cada restaurante usa **suas próprias credenciais Twilio** (Subaccount SID + Auth Token + número WhatsApp aprovado). Não dá pra usar o connector compartilhado porque é multi-tenant.

**Nova tabela `restaurant_whatsapp_config` (public, RLS por restaurante):**
- `restaurant_id` (PK), `twilio_account_sid`, `twilio_auth_token` (criptografado), `whatsapp_number` (E.164 com prefixo `whatsapp:`), `webhook_secret`, `status` ('disconnected'|'pending'|'connected'), `connected_at`

**UI em Settings → "WhatsApp Bot" (nova aba):**
- Wizard 3 passos: (1) Cadastra Account SID + Auth Token + Número, (2) Sistema valida via `verify-whatsapp-config` edge function chamando Twilio API, (3) Mostra URL do webhook pra colar no Twilio Console: `https://akqldesakmcroydbgkbe.supabase.co/functions/v1/whatsapp-inbound?r={restaurant_id}`
- Status: badge "Conectado/Desconectado", botão testar, botão desconectar.

---

## 2. Webhook inbound (cliente → bot)

**Edge function `whatsapp-inbound` (verify_jwt=false, público):**
- Recebe POST `application/x-www-form-urlencoded` do Twilio (From, Body, MediaUrl, etc).
- Identifica restaurante via query param `?r=`, carrega config, valida assinatura Twilio (`X-Twilio-Signature`).
- Normaliza telefone, faz upsert em `restaurant_customers` (cria lead se não existe).
- Salva mensagem em `whatsapp_messages` (nova tabela).
- Invoca `cardapio-chat` com contexto enriquecido (histórico de visitas, prato favorito, status VIP, programa de fidelidade).
- Se IA chama tool `send_dish_image`, gera imagem com overlay e responde via Twilio com TwiML (`<Message><Body>...<Media>...</Message>`).
- Caso contrário, responde só com texto.

**Nova tabela `whatsapp_messages`:**
- `id`, `restaurant_id`, `customer_id` (nullable), `phone`, `direction` ('inbound'|'outbound'), `body`, `media_url`, `twilio_sid`, `ai_response`, `created_at`. Index `(restaurant_id, phone, created_at)`.

---

## 3. Bot conversacional (`cardapio-chat-wa`)

Reaproveita parte do `cardapio-chat` existente mas com tools focadas em conversa com cliente final:
- `get_customer_context(phone)` — busca visitas, último prato, VIP, fidelidade
- `list_dishes_for_recommendation(category?)` — pratos disponíveis com foto
- `send_dish_image(dish_id, headline)` — gera imagem com nome do cliente + headline e marca pra enviar
- `register_reservation_intent(date, party_size)` — cria reserva pendente
- `register_queue_intent(party_size)` — entrada na fila

System prompt em PT-BR, persona do restaurante (puxa nome/descrição), instruído a ser caloroso, lembrar últimas visitas, sugerir prato favorito quando fizer sentido.

Modelo: `google/gemini-2.5-flash` via Lovable AI Gateway (já temos `LOVABLE_API_KEY`).

---

## 4. Gerador de imagem com overlay

**Edge function `generate-dish-overlay`:**
- Input: `dish_id`, `customer_name`, `headline`.
- Carrega foto real do prato em `menu_dishes.image_url`.
- Usa Gemini 2.5 Flash Image (Nano Banana) com prompt: "Add elegant overlay text '{headline}' and customer name '{customer_name}' to this dish photo, restaurant marketing style, preserve the dish".
- Salva em `dish-photos/{restaurant_id}/overlays/{uuid}.jpg`, retorna URL pública.
- Fallback: se prato sem foto, usa Canvas-style fallback ou rejeita pedido.

---

## 5. Painel do dono (já parcialmente feito)

A aba "Chat IA" em `/cardapio` já existe (`CardapioChatTab.tsx`). Vou:
- Renomear pra "Comando IA" e expandir as tools pra incluir `send_via_whatsapp` (manda agora pelo bot conectado).
- Adicionar nova aba **"Conversas WhatsApp"** mostrando histórico de `whatsapp_messages` agrupado por cliente, com filtro/busca.
- Aba **"Configurar Bot"** linka pra Settings → WhatsApp.

---

## 6. Segurança

- `restaurant_whatsapp_config.twilio_auth_token` armazenado em coluna `bytea` cifrada via `pgp_sym_encrypt` com `app.encryption_key` (secret).
- RPCs `set_whatsapp_config`/`get_whatsapp_config` SECURITY DEFINER, validam `is_member_or_admin`.
- Webhook valida `X-Twilio-Signature` usando o auth token descriptografado.
- Rate limit por telefone em `whatsapp-inbound` (max 20 msgs/min) pra prevenir abuso.

---

## 7. Migration única

```text
- create table public.restaurant_whatsapp_config
- create table public.whatsapp_messages + indices + RLS
- rpc public.set_whatsapp_config(...)
- rpc public.get_whatsapp_config(restaurant_id)
- rpc public.delete_whatsapp_config(restaurant_id)
- rpc public.log_whatsapp_message(...) (chamada pela edge)
- bucket dish-photos já existe → adiciona pasta overlays/
```

---

## 8. Secret necessário

`WHATSAPP_CONFIG_ENCRYPTION_KEY` — chave AES pra cifrar auth tokens. Adiciono via `add_secret` antes da implementação.

---

## 9. Fluxo completo

```text
[Cliente Maria manda "oi" no WhatsApp do restaurante]
         │
         ▼
[Twilio webhook → whatsapp-inbound?r={restaurant_id}]
         │  valida assinatura, upsert customer, salva msg
         ▼
[cardapio-chat-wa com contexto (3 visitas, ama nhoque, VIP)]
         │  IA decide: "vou mandar foto do nhoque com nome dela"
         ▼
[Tool send_dish_image → generate-dish-overlay]
         │  Nano Banana adiciona "Maria, seu nhoque te espera 🍝"
         ▼
[Response Twilio TwiML: texto + MediaUrl da imagem]
         │
         ▼
[Maria recebe no WhatsApp]
```

---

## 10. Fora de escopo nesta entrega
- Aprovação Meta do número (responsabilidade do restaurante, doc no painel).
- Templates HSM pra mensagens fora da janela 24h (fase 2).
- Botões interativos WhatsApp (fase 2).
- Métricas/analytics do bot (fase 2 — só log básico agora).

---

## Arquivos a criar/editar

**Criar:**
- `supabase/functions/whatsapp-inbound/index.ts`
- `supabase/functions/cardapio-chat-wa/index.ts`
- `supabase/functions/generate-dish-overlay/index.ts`
- `supabase/functions/verify-whatsapp-config/index.ts`
- `src/components/settings/WhatsAppBotSettings.tsx`
- `src/components/cardapio/WhatsAppConversationsTab.tsx`
- `src/hooks/useWhatsAppConfig.ts`

**Editar:**
- `src/pages/Settings.tsx` (adiciona aba WhatsApp Bot)
- `src/pages/CardapioInteligente.tsx` (adiciona aba Conversas)
- Migration nova

Aprova esse plano pra eu executar?
