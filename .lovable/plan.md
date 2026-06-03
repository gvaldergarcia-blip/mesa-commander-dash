## Sistema de Notificações SMS para Funcionários (Etiquetas)

### Objetivo
Enviar relatório diário por SMS ao chef/funcionário com status das etiquetas do seu(s) setor(es), alertas imediatos de vencimento, e expor configuração + histórico no painel.

---

### 1. Banco de dados (migration)

**Adicionar colunas em `label_employees`:**
- `sms_daily_enabled boolean default false`
- `sms_daily_hour int default 8` (06–23)
- `sms_immediate_alerts boolean default true`
- `sms_include_checklists boolean default false`
- (telefone já existe em `whatsapp_phone`)

**Nova tabela `label_sms_logs`:**
- `id, restaurant_id, employee_id (nullable), phone, message, status ('sent'|'failed'|'delivered'), error, kind ('daily'|'expiry_alert'|'test'|'manual'), sent_at`
- RLS: membros do restaurante leem; service_role full.
- GRANTs corretos.

---

### 2. UI — Perfil do funcionário (`EmployeeFormDialog`)

Nova seção "Notificações SMS" com:
- Toggle **Receber relatório diário**
- Dropdown **Horário** (06:00 → 23:00)
- Toggle **Alertas imediatos de vencimento**
- Toggle **Incluir resumo de checklists**
- Telefone (já existe, manter validação BR)
- Botão **Enviar teste agora** → chama edge `send-label-daily-report` em modo `test`

Persistir novos campos via `useLabelEmployees`.

---

### 3. Edge functions

**`send-label-daily-report`** (nova)
- Input: `{ employee_id, mode: 'scheduled'|'test'|'expiry_alert', triggered_label_id? }`
- Carrega funcionário, setores, e:
  - Etiquetas do restaurante nos setores do funcionário
  - Conta: vencidas, vence hoje, vence em 24h, ok
  - Opcional: itens de checklist pendentes/atrasados
- Monta mensagem ≤320 chars:
  ```
  [MESACLIK] Olá {nome}.
  Vencidas: X | Hoje: Y | 24h: Z
  ⚠ Atenção: {3 primeiros itens}
  Painel: {link}
  ```
  Se tudo ok → `Tudo dentro do prazo ✅` no lugar.
- Chama `send-sms` interno (delegação SMS já documentada).
- Grava `label_sms_logs`.
- Retorna preview da mensagem.

**`schedule-label-sms-reports`** (nova, agendada por cron)
- Roda a cada hora (`0 * * * *`).
- Seleciona funcionários com `sms_daily_enabled=true` e `sms_daily_hour = hora-atual-no-fuso-do-restaurante` (assumir America/Sao_Paulo).
- Invoca `send-label-daily-report` em modo `scheduled` para cada.

**Trigger de alerta imediato:**
- Em `useLabelProducts`/onde marca etiqueta vencida, ou via cron mais granular (a cada 15 min) verificando etiquetas que **acabaram de vencer** e ainda não tiveram alerta enviado (usar `label_sms_logs` para deduplicar por `triggered_label_id`).
- Para simplificar: rodar a cada 15 min `check-label-expiry-alerts` que detecta `expires_at <= now()` sem log de alerta, e dispara para funcionários do setor com `sms_immediate_alerts=true`.

Cron via `pg_cron` + `pg_net` (inserts em `supabase.insert`, não migration).

---

### 4. Tela de logs

**Etiquetas > Relatórios > aba "Histórico de SMS"**
- Lista paginada de `label_sms_logs`: data/hora, destinatário (nome + telefone mascarado), tipo, status, preview da mensagem (expandir para ver completa).
- Filtros: período, funcionário, status.

---

### 5. Conteúdo / regras

- Sempre prefixo `[MESACLIK]`.
- Sempre link ao painel no fim (`https://app.mesaclik.com.br/etiquetas`).
- ≤320 chars (validar antes de enviar; truncar lista de itens se exceder).
- Tudo ok → uma linha resumo positiva.
- Alertas imediatos ignoram horário.

---

### 6. Telefone do chef para teste

O número que receberá o SMS é o cadastrado em `whatsapp_phone` do funcionário (chef). O botão **Enviar teste agora** garante validação ponta-a-ponta antes de ativar o envio diário.

---

### Arquivos previstos
- Migration: colunas + tabela `label_sms_logs`
- `supabase/functions/send-label-daily-report/index.ts`
- `supabase/functions/schedule-label-sms-reports/index.ts`
- `supabase/functions/check-label-expiry-alerts/index.ts`
- `src/components/labels/EmployeeFormDialog.tsx` (nova seção)
- `src/hooks/useLabelEmployees.ts` (novos campos)
- `src/hooks/useLabelSmsLogs.ts` (novo)
- `src/components/labels/SmsLogsTab.tsx` (novo)
- `src/pages/EtiquetasPage.tsx` (nova aba em Relatórios)
- SQL cron via insert tool

Tudo pronto para implementação após aprovação.
