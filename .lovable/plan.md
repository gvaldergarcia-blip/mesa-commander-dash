# Dashboard operacional do módulo Etiquetas

## Objetivo
Transformar a entrada do módulo Etiquetas em uma central operacional enxuta, mantendo intactos impressão, renovação, baixa, produtos, estoque e demais fluxos.

## Alterações
- Tornar **Dashboard** a entrada padrão ao abrir Etiquetas e remover **Relatórios** da navegação.
- Substituir o dashboard atual por um cabeçalho com saudação, restaurante, usuário e data atual.
- Exibir exatamente quatro cards dominantes: **Itens vencidos**, **Vencem amanhã**, **Precisam de renovação** e **Tudo certo**.
- Calcular vencidos e amanhã pela validade original do fabricante; calcular renovação apenas pela lógica pós-abertura já existente.
- Garantir categorias operacionais sem dupla contagem, considerando somente etiquetas ativas com saldo.
- Fazer cada card abrir, em um clique, a tela existente já filtrada: produtos vencidos, produtos que vencem amanhã, renovação pendente ou produtos regulares.
- Na visualização de vencidos/amanhã/OK, reutilizar a baixa existente e mostrar produto, lote, validade original, local e responsável.
- Remover gráficos, relatórios, status do sistema, atividades e demais blocos secundários do dashboard.

## Design e responsividade
- Preservar o tema escuro e os tokens visuais do MesaClik.
- Usar cards grandes, hierarquia forte, cores sem exagero e áreas de toque confortáveis.
- Organizar em uma coluna no celular e grade no desktop, sem rolagem horizontal ou efeitos pesados.

## Detalhes técnicos
- Reutilizar as consultas em cache de etiquetas, produtos e renovações; nenhuma tabela ou migração será criada.
- Levar o filtro na URL para que o destino seja aberto já no estado correto.
- Manter a regra de renovação e o limite pela validade original exatamente como estão.
- Validar compilação e comportamento responsivo após a implementação.
