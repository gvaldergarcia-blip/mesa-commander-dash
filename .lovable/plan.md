# MesaClik como Sistema Operacional da Cozinha (escopo: /etiquetas)

Toda mudança fica **dentro do módulo Etiquetas**. Nenhum outro módulo do app é tocado.

## Diagnóstico

Dentro de `/etiquetas` temos 9 abas que hoje funcionam como ilhas: Dashboard, Recebimento, Etiquetas, Imprimir, Compras, Estoque, Produtos, Funcionários, SMS. Cada uma grava numa tabela própria. Não existe uma fonte única que descreva "o que aconteceu na cozinha hoje". Recebimento virou mais uma ilha.

## Princípio

Toda ação da cozinha é um **evento** gravado numa única timeline. As abas viram *janelas* sobre essa timeline. Etiquetas, estoque, relatórios e IA são **consequências automáticas** — nunca dados digitados de novo.

```text
                       ┌──────────────────────────┐
  Recebimento (XML/CSV)│                          │──► Etiquetas (auto)
  Manipulação          │   kitchen_events         │──► Estoque (auto)
  Consumo / Perda      │   (fonte única)          │──► Diário Operacional
  Transferência        │                          │──► Relatórios
  Impressão / Baixa    └──────────────────────────┘──► IA / Alertas
```

## Nova arquitetura de dados

### 1. `kitchen_events` (nova — coração do módulo)
Registro imutável. Campos:
- `event_type` enum: `receipt`, `label_issued`, `label_discharged`, `manipulation`, `consumption`, `loss`, `transfer`, `stock_check`, `purchase_request`
- `product_id`, `supplier_id`, `employee_id`, `receipt_id`, `label_id` (nullable)
- `quantity numeric`, `unit text` (opcionais hoje, preparados p/ futuro quantitativo)
- `occurred_at`, `payload jsonb`
- `restaurant_id` + RLS por membership + grants

### 2. Tabelas atuais viram projeções
- `label_issuances`, `label_receipts`, `label_discharges`, `label_stock_movements`, `stock_check_logs`: mantidas. **Triggers** espelham cada insert para `kitchen_events`.
- `product_stock_status` (Ok/Falta): permanece — passa a ser complementada pela view de saldo.
- `label_reprint_queue`: continua, disparada por evento `label_discharged` quando `auto_reprint = true`.

### 3. Views derivadas
- `v_operational_diary` — feed cronológico com joins em produto/fornecedor/funcionário.
- `v_stock_balance` — soma entradas − saídas por produto. Retorna `null` enquanto `quantity` não for preenchida; funcional para "o que existe hoje" desde já.

### 4. Preparado para o futuro (sem UI agora)
- **Quantidade real**: campos já existem em `kitchen_events`.
- **Saídas manuais**: basta inserir evento `consumption` — motor pronto.
- **Alertas** ("800g de parmesão vencem amanhã"): view cruza `v_stock_balance` × validade das etiquetas ativas.
- **Sugestão de compra**: cron lê saldo < mínimo e gera `purchase_request`.
- **IA**: treina em cima de `kitchen_events`.

## Reorganização das abas (dentro de /etiquetas)

De 9 abas para **4 áreas**:

```text
1. HOJE (nova aba default)
   ├─ Diário operacional (feed de eventos em tempo real)
   ├─ Alertas (vence hoje, faltas, sugestões)
   └─ Ações rápidas (nova etiqueta, novo recebimento)

2. ENTRADAS
   ├─ Recebimento (XML/CSV/PDF, manual como fallback)
   ├─ Fornecedores
   └─ Histórico

3. OPERAÇÃO
   ├─ Etiquetas ativas
   ├─ Impressão avulsa
   ├─ Estoque (check rápido; saldo quantitativo futuro)
   └─ Baixas / Perdas / Transferências (esqueleto pronto, UI depois)

4. CADASTROS
   ├─ Produtos (+ Catálogo MesaClik)
   ├─ Funcionários + SMS
   └─ Relatórios
```

Botão "Nova etiqueta" continua existindo como atalho — passa a gravar evento `label_issued` no mesmo fluxo.

## Fluxo unificado (exemplo)

Fornecedor entrega mussarela na terça:

```text
1. Arrasta XML da NF-e            → parse
2. Sistema faz matching           → 8 conhecidos, 2 pendentes
3. Preenche só o que falta        → validade/setor dos 2
4. Um clique em "Confirmar"       → dispara:
     • N eventos `receipt`
     • N eventos `label_issued` (auto)
     • Aprende aliases
     • Atualiza fornecedor padrão
     • Atualiza saldo
     • Aparece no Diário
     • Reprint queue se auto_reprint
     • Alertas recalculam
```

Nenhuma outra tela precisa ser tocada.

## Plano de migração (sem quebrar nada)

**Passo 1 — Fundação SQL**
- `kitchen_events` + enum + RLS + grants
- Views `v_operational_diary` e `v_stock_balance`
- Triggers de espelhamento em `label_issuances`, `label_receipts`, `label_discharges`, `label_stock_movements`, `stock_check_logs`
- Backfill dos últimos 90 dias

**Passo 2 — Aba "Hoje"**
- Nova aba em `EtiquetasPage` alimentada por `v_operational_diary`
- Vira aba default (Dashboard atual permanece acessível)

**Passo 3 — Recebimento grava via evento**
- `useReceipts` passa por RPC transacional que cria receipt + itens + movimentos + eventos + etiquetas + aliases num só passo
- Visualmente idêntico ao usuário

**Passo 4 — Consolidação das abas**
- Agrupar as 9 abas nas 4 áreas
- Manter as antigas por 1 ciclo com redirect

**Passo 5 — Campos quantitativos opcionais**
- `quantity` / `unit` opcionais no recebimento
- Começa a acumular dado para IA

Cada passo é independente e reversível. Nada fora de `/etiquetas` é tocado.

---

**Se aprovar, começo pelo Passo 1** (migração + triggers + views) — fundação que destrava o resto sem alterar nenhuma tela ainda.
