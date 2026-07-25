# Rascunho de Recebimento sincronizado entre dispositivos

## Problema
Hoje o "Recebimento por fotos" guarda tudo (fotos, agrupamentos da IA, lotes, POP) apenas na memória do navegador (`photoFirstStore` em `src/components/labels/receiving/photoFirstStore.ts`). Por isso, ao começar no celular e abrir no computador — mesmo logado na mesma conta — o computador não vê nada. Só existe registro no banco quando o dono clica em **Finalizar / Imprimir**, e nesse ponto o `label_receipt` é criado.

## Solução
Persistir o rascunho no Supabase, por restaurante, com auto-save contínuo, e carregar automaticamente ao abrir o módulo em qualquer dispositivo. Fotos vão para o Storage (não ficam mais só como blob local).

## O que muda para o usuário
- Ao tirar fotos no celular, o card **"Rascunho em andamento"** já aparece no computador em segundos.
- O botão **Continuar** no computador reabre exatamente o mesmo estado (fotos + produtos identificados + lotes escolhidos + POP).
- Só um rascunho ativo por restaurante (o fluxo atual já assume isso). Se dois dispositivos editarem ao mesmo tempo, o último a salvar vence (com aviso).
- Ao **Concluir sessão** ou finalizar o recebimento, o rascunho é apagado.

## Detalhes técnicos

### Banco (nova migration)
- Bucket privado `label-receipt-drafts` no Storage (path `{restaurant_id}/{draft_id}/{photo_id}.jpg`).
- Tabela `public.label_receipt_drafts`:
  - `id uuid pk`, `restaurant_id uuid` (unique — 1 rascunho ativo por restaurante), `supplier_id`, `reference`, `groups jsonb`, `photos jsonb` (id + storage_path + width/height), `finalized_receipt_id`, `updated_by`, `updated_at`.
  - RLS: acesso só a membros do restaurante (`is_member_or_admin`). GRANTs para `authenticated` + `service_role`.
- Realtime habilitado para propagar mudanças entre dispositivos.

### Frontend
- `photoFirstStore.ts`: adicionar `draftId`, `hydrated`, `saving`; funções `loadFromRemote(restaurantId)`, `persist()` (debounce 800 ms), `clearRemote()`.
- Upload de foto: ao adicionar arquivo, comprimir (já existe), enviar ao Storage, guardar `storage_path` + URL assinada. Preview usa URL assinada em vez de `blob:` quando vier do remoto.
- `PhotoFirstReceiving.tsx`: hidratar do remoto ao abrir; salvar após cada mutação relevante (add/remove foto, resultado da IA, edição de campo, escolha de lote, POP).
- `ReceivingTab.tsx`: o card "Rascunho em andamento" passa a ler do estado hidratado; assina Realtime para atualizar contadores.
- Ao finalizar (`printFromReceipt` bem-sucedido) ou clicar **Concluir sessão**: chamar `clearRemote()` (apaga row + arquivos do bucket).

### Fora de escopo
- Edição colaborativa simultânea (dois dispositivos digitando ao mesmo tempo no mesmo campo). Mantém "último salva vence".
- Migração de rascunhos locais antigos — quem tinha rascunho só em memória perde ao atualizar (aviso no card se detectar estado local sem `draftId`).

```text
Celular                              Supabase                       Computador
  tira foto ──► upload Storage ──►  drafts row ──► Realtime ──►  card "Rascunho" atualiza
  IA agrupa  ──► persist(groups) ──► drafts row ──► Realtime ──►  Continuar abre estado igual
  finaliza   ──► clearRemote     ──► delete row/files ──────────► card some
```
