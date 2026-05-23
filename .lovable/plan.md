## Visão geral

Reformular o módulo de Etiquetas (`/etiquetas`) em um sistema premium completo, com dashboard, fluxo de impressão em 3 passos, QR code de baixa, gestão de produtos/funcionários, alertas e exportação — tudo integrado ao Supabase com RLS por restaurante.

O trabalho é grande (estimativa: ~15 arquivos novos + 4 migrações). Vou entregar em **3 fases** para que você possa revisar entre cada uma.

---

## Fase 1 — Banco de dados e fundação

### Migrações Supabase

1. **`label_employees`** (funcionários da cozinha)
   - `restaurant_id`, `name`, `role`, `pin` (4 dígitos opcional), `status` (ativo/inativo)
   - RLS: membros do restaurante leem/escrevem

2. **`label_product_groups`** (grupos/setores)
   - `restaurant_id`, `name`, `color`

3. **Extensão de `label_products`** (adicionar colunas)
   - `group_id`, `conservation_method` (resfriado/congelado/ambiente/quente), `unit` (g/kg/ml/L/un), `status`

4. **Extensão de `label_issuances`** (alterar para virar "labels")
   - `unique_code` (6 chars alfanuméricos, único por restaurante), `employee_id`, `conservation_method`
   - Status passa a incluir `discharged` com tipo de baixa

5. **`label_discharges`** (histórico de baixas)
   - `label_id`, `employee_id`, `reason` (use/loss/error), `discharged_at`, `notes`

6. **RPC `discharge_label`** (SECURITY DEFINER) — valida posse e registra baixa atômica.

7. **RPC `get_label_by_code`** público (para a página de scan do QR funcionar sem login).

---

## Fase 2 — UI: Dashboard, filtros e listagem

### Arquivos novos

- `src/hooks/useLabelEmployees.ts`
- `src/hooks/useLabelGroups.ts`
- `src/hooks/useLabels.ts` (substitui `useLabelIssuances`, com filtros e bulk)
- `src/components/labels/LabelStatsCards.tsx` — 5 cards clicáveis
- `src/components/labels/LabelFilters.tsx` — barra de filtros avançados
- `src/components/labels/LabelsList.tsx` — listagem com checkbox bulk, color-coding por validade
- `src/components/labels/EmployeeFormDialog.tsx`
- `src/components/labels/GroupFormDialog.tsx`

### Reescrita

- `src/pages/EtiquetasPage.tsx` — vira o dashboard com tabs: **Dashboard | Imprimir | Produtos | Funcionários**

---

## Fase 3 — Fluxos: impressão 3-step, QR scan, bulk, export

### Fluxo de impressão (3 passos full-screen)

- `src/components/labels/print-flow/StepSelectEmployee.tsx` — cards de funcionários com avatar de iniciais
- `src/components/labels/print-flow/StepSelectProduct.tsx` — busca de produtos
- `src/components/labels/print-flow/StepConfirmPrint.tsx` — formulário + preview 80×40mm com QR

### QR scan público

- `src/pages/EtiquetaScan.tsx` (rota `/etiquetas/scan/:code`) — página mobile-first com header de status, info da etiqueta, e botão "Baixar Etiqueta" com 3 opções (Uso/Perda/Erro). Banner vermelho se vencida; bloco cinza se já baixada.
- Edge function leve `get-label-info` ou uso direto do RPC `get_label_by_code`.

### Bulk e export

- `src/components/labels/BulkActionsBar.tsx` — aparece quando há seleção
- `src/lib/labels/export.ts` — gera CSV (PDF fica para iteração posterior, se ok)

### Alertas

- Toast no carregamento do dashboard ("X produtos vencem hoje")
- Badge no item da sidebar quando há vencimentos do dia

---

## Design system

Já existe tema dark. Vou usar tokens semânticos (`primary`, `destructive`, `warning`, `success`) — sem cores hardcoded. O `#FF6200` provavelmente já é o `--primary`. Confirmo no `index.css` antes.

---

## Confirmações antes de começar

1. **OK em entregar nessa ordem (Fase 1 → 2 → 3) com pausa entre fases?** Ou prefere tudo de uma vez (resposta gigante, maior risco de erro)?
2. **Funcionários do módulo de Etiquetas:** crio uma tabela separada `label_employees` (mais simples, sem auth/login) — ou prefere reutilizar a tabela de equipe (`team_members`) que já existe? Tabela separada é mais rápida e isolada; reutilizar evita duplicidade.
3. **PDF de export:** prioridade baixa? CSV cobre o caso de uso?

Confirma e eu começo pela Fase 1.