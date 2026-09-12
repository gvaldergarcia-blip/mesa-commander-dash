# MesaClik Modular — Análise e Proposta (Etapa 1, sem alterar código)

## O que já existe hoje

**Onde fica a conta do restaurante**
- Cada restaurante tem um cadastro central, e o usuário é ligado a ele por uma lista de membros (com papel Administrador ou Operador).
- Ao entrar, o sistema descobre sozinho qual restaurante é o do usuário e carrega nome, logo e dados.

**Serviços contratados (já existe, mas limitado)**
- Já existe um campo de "módulos do plano" no cadastro do restaurante, mas ele só aceita três valores: Fila, Reserva ou Fila+Reserva.
- No cadastro/onboarding, a escolha do interessado é gravada como "fila", "reserva" ou "ambos" — mesma limitação.
- Ou seja: Etiquetas, Checklist, Relatórios, Clientes e Redes Sociais **não têm controle de contratação nenhum** — aparecem para todo mundo.

**Como o menu decide o que mostrar hoje**
- Fila e Reservas somem se o plano não incluir.
- Clientes, Relatórios, Promoções, Studio e Configurações só aparecem para Administrador.
- Etiquetas e Checklist aparecem sempre, sem regra.
- Há ainda "chaves de funcionalidade" fixas no código (Promoções e Marketing IA desligados hoje) — isso é global, não por restaurante.

**Conclusão:** a base de modularidade existe, mas foi feita só para dois módulos. Vamos ampliá-la, não substituí-la.

## Proposta

### 1. Lista de módulos aberta
Trocar o campo único de texto ("FILA_RESERVA") por uma **lista de módulos contratados** por restaurante: `etiquetas`, `fila`, `reservas`, `checklist`, `clientes`, `relatorios`, `social`, `promocoes`.
- O campo antigo continua existindo e é convertido automaticamente (quem tem "FILA_RESERVA" passa a ter fila + reservas + os módulos que já usa hoje). Ninguém perde acesso.
- Adicionar um módulo novo no futuro = acrescentar um item nessa lista. Nada mais.

### 2. Um registro único de módulos no código
Um arquivo central descreve cada módulo: chave, nome, ícone, rota, se exige Administrador. O menu, as rotas e a tela inicial passam a ser gerados a partir dessa lista — hoje essas três coisas estão espalhadas.

### 3. Ativação e bloqueio
- **Menu:** só mostra o que o restaurante contratou.
- **Rotas:** acesso direto por link a um módulo não contratado mostra uma tela "Módulo não contratado" com convite para falar com o MesaClik (em vez do redirecionamento silencioso de hoje).
- **Tela inicial inteligente:** quem contratou só Etiquetas cai direto na tela de Etiquetas ao entrar, sem passar por um painel de Fila/Reservas vazio. Quem tem vários módulos continua no painel geral.
- **Painel geral adaptativo:** os blocos de Fila/Reservas do painel só aparecem para quem tem esses módulos; quem tem Etiquetas vê blocos de validade/estoque.

### 4. Onboarding
Na seleção de serviços do cadastro, o interessado passa a marcar vários serviços (caixas de seleção) em vez de escolher entre fila/reserva/ambos. Na aprovação do restaurante, essa seleção é copiada direto para os módulos da conta. Administradores da plataforma podem ajustar depois.

### 5. Configurações
Na tela de Plano, mostrar a lista de módulos ativos e os disponíveis para contratar (somente leitura para o restaurante; edição para administrador da plataforma).

## Detalhes técnicos

- **Banco:** nova coluna `plan_modules_list text[]` em `public.restaurants` (e espelho em `mesaclik.restaurants`), preenchida por migração a partir de `plan_modules`. Gatilho de sincronização já existente é estendido. `plan_modules` fica como campo legado para não quebrar integrações.
- **Onboarding:** `founder_leads.modules_selected` passa a aceitar lista separada por vírgula; `approve-restaurant` grava `plan_modules_list`.
- **Frontend:**
  - `src/config/modules.ts` (novo) — registro declarativo dos módulos.
  - `ModulesContext` — expandido para carregar a lista, manter compatibilidade com `hasModule('fila'|'reserva')` e expor `modules: ModuleKey[]`.
  - `ModuleGuard` — passa a aceitar qualquer chave e renderizar tela de bloqueio.
  - `Sidebar` e `App.tsx` — geradas a partir do registro.
  - `RoleGuard` e as feature flags atuais continuam funcionando por cima do filtro de módulos.
- **Ordem segura de implementação:** (1) migração com conversão automática; (2) registro de módulos + contexto; (3) menu e rotas; (4) tela inicial e painel adaptativos; (5) onboarding; (6) tela de Plano.

## Riscos e garantias
- Ninguém perde acesso: a conversão dá a todos os restaurantes atuais todos os módulos que já enxergam hoje.
- Sem duplicação de código ou versões separadas do sistema — uma aplicação só.
- Nenhuma lógica interna de Etiquetas, Fila, Reservas ou Checklist é tocada.
