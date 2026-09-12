# Navegação inferior e compactação mobile de Etiquetas

## Objetivo

Transformar exclusivamente a experiência mobile do módulo Etiquetas em uma navegação de aplicativo, preservando integralmente desktop, regras, dados e ações existentes.

## Alterações mobile

- Substituir a faixa de abas no topo por uma barra inferior fixa, sólida e rolável horizontalmente.
- Manter no topo apenas o cabeçalho compacto com menu, módulo, tela atual e tema.
- Exibir Dashboard, Imprimir, Hoje, Renovação, Recebimento, Estoque e Cadastro.
- Destacar a tela ativa em laranja e deslocar automaticamente o carrossel para mantê-la visível.
- Usar as URLs e estados atuais; “Hoje” reutilizará o conteúdo operacional existente em uma tela mobile própria, enquanto no desktop continuará integrado ao Dashboard.
- Reservar espaço inferior considerando a barra, a área segura do iPhone e os botões fixos dos fluxos.

## Compactação das telas

- Reduzir espaços, títulos, cartões e blocos repetidos somente abaixo de 768 px.
- Em Imprimir, manter busca e filtros acessíveis, adicionar Hortifruti, compactar a lista e preservar a etapa dedicada de preenchimento e a prévia.
- Em Cadastro, adicionar filtros horizontais por conservação, compactar a lista e manter somente visualizar, editar, excluir e cadastrar no mobile; impressão continuará oculta.
- Ajustar barras fixas de Imprimir, Renovação e Recebimento para ficarem acima da nova navegação inferior.
- Evitar alturas fixas, rolagem dentro de rolagem e qualquer overflow horizontal da página.

## Desktop protegido

- Não alterar menu lateral, cabeçalhos, grades, cartões, formulários ou ações desktop.
- Aplicar todas as mudanças visuais com o breakpoint mobile existente.

## Validação

- Conferir 320, 375, 390 e 430 px, além do desktop.
- Testar item ativo, rolagem independente do carrossel, troca de telas e visibilidade automática da aba ativa.
- Verificar que o último conteúdo e os botões fixos não ficam cobertos.
- Confirmar ausência de overflow lateral, erros de compilação e regressões de desktop.

## Detalhes técnicos

- Reutilizar `Tabs`, parâmetros de URL, callbacks e componentes atuais.
- Usar referências dos itens para `scrollIntoView` somente no eixo horizontal.
- Usar tokens semânticos existentes e safe-area via `env(safe-area-inset-bottom)`.
- Não alterar hooks de dados, Supabase, impressão, estoque, recebimento, cadastro ou regras de validade.
