# Plano de execução — Automação total (Etiquetas + GPS + Studio IA)

Três frentes independentes, entregues em ordem de impacto. Nenhuma remove funcionalidade existente — todas somam camadas de automação.

---

## Frente 1 — Etiquetas Autônomas ("cadastre uma vez, o sistema trabalha sozinho")

**Regra atual:** o operador abre o PrintFlow, escolhe produto, preenche data, imprime.
**Regra nova:** o produto já tem validade padrão cadastrada — o sistema decide, imprime em lote e avisa sozinho.

### O que muda
1. **Cadastro único enriquecido** (`label_products`): adicionar `default_shelf_life_hours`, `default_conservation`, `auto_reprint_enabled`, `preferred_printer_label`.
2. **Baixa = re-emissão automática:** quando uma etiqueta é dada como `discharged` via QR, um trigger cria uma pendência de nova etiqueta (mesmo produto, nova validade calculada). Fila aparece em "Etiquetas → Pendentes de reimpressão".
3. **Impressão em lote diária (Sugestão do dia):** ao abrir a página de Etiquetas de manhã, um card mostra "12 etiquetas sugeridas para hoje" baseado no histórico de consumo do restaurante (média móvel de 14 dias por produto). 1 clique imprime todas.
4. **Alertas proativos já existem** (`check-label-expiry-alerts`) — vou ampliar para incluir "produto X costuma vencer hoje neste horário, quer reemitir?".
5. **Auto-baixa por vencimento + registro:** etiqueta vencida há mais de X horas (config) entra em `auto_discharged` para não poluir o dashboard.

### Entregáveis técnicos
- Migração: novas colunas em `label_products`, tabela `label_reprint_queue`, trigger `on_label_discharged_enqueue_reprint`.
- Hook `useLabelReprintQueue`.
- Componente `SmartReprintCard` no topo da lista de etiquetas.
- Update de `check-label-expiry-alerts` para sugerir reemissão.
- Config de `default_shelf_life_hours` no `ProductFormDialog`.

---

## Frente 2 — Visitas por GPS (opt-in de promoções = compartilha localização)

**Fluxo novo do cliente final:**
1. Cliente entra na landing de opt-in de promoções (existe em `MarketingOptIn.tsx`).
2. Ao marcar "Quero receber promoções", o browser pede permissão de geolocalização.
3. Sem permissão → não completa opt-in (regra opcional, configurável por restaurante).
4. Com permissão → salva `location_consent = true` + geofence do restaurante em `restaurant_customers`.
5. Um Service Worker leve (ou verificação periódica via PWA) checa proximidade. Ao entrar no raio de 80m do restaurante por mais de 3 min → dispara `register-gps-visit` que insere em `customer_visits` com `source = 'gps'`.

### Entregáveis técnicos
- Migração: colunas `location_consent`, `location_consent_at`, `last_gps_visit_at` em `restaurant_customers`; colunas `latitude`, `longitude`, `gps_geofence_radius_m` em `restaurants` (se ainda não existirem).
- Edge function `register-gps-visit` (SECURITY DEFINER RPC internamente, valida distância server-side com Haversine).
- Componente `GpsConsentGate` em `MarketingOptIn.tsx`.
- Hook `useGeofenceTracker` (usa `navigator.geolocation.watchPosition` só quando página aberta; para background real é preciso app nativo — anotado como Fase 2).
- Card "Visitas por GPS" no CRM do cliente mostrando histórico com pin no mapa.

### Limitações honestas
- Web puro só rastreia com a aba aberta. Para tracking em background de verdade precisamos do app Capacitor (já temos base). Vou entregar a versão web + deixar o gancho pronto para o mobile.

---

## Frente 3 — MesaClik Studio Autônomo (redes sociais no automático)

**Regra atual:** operador abre o Studio, digita prompt, gera imagem, aprova, agenda.
**Regra nova:** o Studio propõe conteúdo semanal sozinho, o dono só aprova/edita.

### O que muda
1. **Piloto automático semanal:** cron dominical roda `social-suggest-daily` para cada restaurante ativo com Studio ligado. Gera 3-5 sugestões (imagem + copy + melhor horário) para a semana inteira, baseadas em:
   - Cardápio real (`menu_dishes`) — rotaciona pratos que não apareceram nos últimos 30 dias.
   - Dias especiais (`restaurant_special_dates`).
   - Datas comerciais nacionais (Dia dos Namorados, Sexta-feira, etc. — tabela `commercial_dates` seed).
2. **Fila de aprovação em 1 clique:** nova aba "Aprovar da semana" no Studio com swipe (aprova/pula/edita).
3. **Auto-post opcional:** quando o restaurante marca "confio, publique sozinho", agendamentos aprovados vão direto para o `dispatch-dish-campaigns` (já existe).
4. **Reuso inteligente de imagens** — resolve a queixa "alimentar imagens dá trabalho": o Studio prioriza reaproveitar assets já em `promotions_assets` variando só a copy, e só gera imagem nova quando não há material adequado. Reduz de "toda semana subir foto" para "1 sessão de fotos por mês + IA rotacionando".

### Entregáveis técnicos
- Migração: `studio_autopilot_settings` (por restaurante: enabled, frequency, auto_publish, categories), `studio_weekly_suggestions`.
- Cron: `schedule-studio-weekly` (domingo 08:00 SP).
- Update do `social-suggest-daily` para modo semanal em lote.
- Aba "Piloto automático" em `IACreatorMarketing.tsx` com toggle master + tabela de sugestões pendentes.
- Componente `WeeklyApprovalQueue`.

---

## Ordem de execução

```text
Dia 1: Frente 1 (Etiquetas autônomas)  ── mais próximo do que já existe, entrega rápida
Dia 2: Frente 3 (Studio autopilot)     ── reutiliza edge functions atuais
Dia 3: Frente 2 (GPS visitas)          ── mais delicada por permissões e privacidade
```

## Fora do escopo (backlog explícito)
- Rastreamento GPS em background real (exige app nativo Capacitor publicado).
- Integração direta com impressora térmica via Bluetooth (hoje é `window.print`).
- Publicação real no Instagram/Facebook API (hoje é agendamento interno; integração Meta Graph API é fase futura).

Confirma que sigo nessa ordem?
