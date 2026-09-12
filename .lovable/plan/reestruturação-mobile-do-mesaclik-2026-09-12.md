# Reestruturação mobile do MesaClik

## Objetivo deste marco

Criar uma experiência própria de aplicativo para smartphones, mantendo a versão desktop e toda a lógica atual intactas. A implementação começa pelo shell mobile e pelo módulo Etiquetas; os demais módulos só serão adaptados depois da validação desse padrão.

## Escopo protegido

- Não alterar banco, RPCs, permissões, regras de validade, impressão, renovação, recebimento, estoque ou rotas existentes.
- Não recriar consultas nem duplicar regras: os novos fluxos mobile reutilizarão estados, hooks e ações atuais.
- Não reintroduzir itens já removidos. A navegação contextual de Etiquetas terá apenas: Dashboard, Imprimir, Renovação, Recebimento, Estoque, Cadastro e Funcionários.
- Desktop continuará com a estrutura atual; mudanças próprias de smartphone serão aplicadas abaixo de 768 px.

## Fase 1 — Shell mobile

- Tornar o topo mobile estável e sempre visível, com botão de menu, módulo “Etiquetas” e nome da tela atual.
- Adicionar uma faixa contextual compacta e rolável somente nela, com a aba ativa destacada e navegação pelas URLs atuais.
- Manter uma única rolagem vertical principal; remover alturas e rolagens internas desnecessárias no conteúdo mobile.
- Garantir área segura inferior, largura mínima zero e proteção global contra overflow horizontal.
- Preservar integralmente o cabeçalho e menu lateral de desktop.

## Fase 2 — Etiquetas mobile

### Dashboard
- Compactar a introdução e priorizar os quatro atalhos operacionais existentes.
- Manter cartões tocáveis, números legíveis e abertura direta da lista correspondente.
- Reduzir blocos secundários no mobile sem remover o conteúdo do desktop.

### Imprimir etiqueta
- Separar em duas telas mobile: seleção do produto e configuração da etiqueta.
- Na seleção, manter busca no topo e lista vertical com nome, marca/fornecedor, conservação e seta.
- Na configuração, mostrar voltar, produto escolhido, lote, validade original, quantidade, unidade, responsável, resultado e prévia real da etiqueta.
- Fixar “Imprimir etiqueta” no rodapé mobile, respeitando teclado e área segura.
- Reutilizar exatamente o cálculo e a ação de impressão atuais; desktop permanece lado a lado como hoje.

### Renovação
- Exibir uma lista operacional compacta no mobile.
- Ao selecionar um item, abrir uma tela própria com comparação de validades, quantidade e CTA fixo “Renovar e imprimir”.
- Reutilizar a função atual de renovação e impressão sem alterar regras.

### Recebimento
- Organizar somente no mobile em etapas: referência/fornecedor, produtos, conferência e ação final.
- Reutilizar o mesmo estado, importação de nota e gravação atuais.
- Fixar as ações “Só computar” e “Imprimir e computar” na etapa final.

### Cadastro, Estoque e Funcionários
- Transformar Cadastro em lista vertical mobile, priorizando visualizar, editar, excluir e criar.
- Ocultar o atalho de impressão nos itens do Cadastro apenas no mobile.
- Ajustar Estoque e Funcionários para leitura e toque confortáveis, sem alterar ações ou dados.
- Fazer formulários e diálogos ocuparem a tela útil no smartphone, com campos de toque confortável e ação acessível.

## Validação obrigatória

- Conferir larguras 320, 375, 390 e 430 px, além de tablet e desktop.
- Verificar ausência de overflow lateral, sobreposição, texto cortado e rolagem interna concorrente.
- Testar navegação entre abas, voltar nos fluxos, busca, seleção, abertura/fechamento de formulários e CTAs fixos.
- Confirmar que o desktop não sofreu mudança visual e que a compilação, console e execução estão limpos.

## Fase 3 — Após validação de Etiquetas

Aplicar o mesmo shell e os padrões aprovados, módulo por módulo, em Fila, Reservas, Checklist, Clientes, Relatórios e demais telas. Esta fase ficará fora do primeiro marco para evitar uma reformulação ampla antes da validação operacional no celular.

## Detalhes técnicos

- Criar componentes mobile focados e reutilizáveis para cabeçalho contextual, faixa de abas, tela de operação e barra fixa de ação.
- Usar o breakpoint e os componentes visuais já existentes; compartilhar callbacks e dados entre as apresentações desktop e mobile.
- Usar classes semânticas do tema atual e áreas de toque de pelo menos 44 px.
- Evitar novas requisições: filtros e apresentações mobile serão derivados dos dados já carregados.
