# Reorganizar o menu de Etiquetas

## Objetivo
Levar as funcionalidades de Etiquetas para o menu principal, mantendo cada módulo contratado independente.

## Alterações
- Transformar **Etiquetas** em um grupo expansível no menu lateral.
- Exibir dentro dele: Imprimir etiqueta, Hoje, Renovação, Recebimento, Produção Interna, Estoque, Produtos, Etiquetas ativas, Funcionários, Relatórios e SMS.
- Ao clicar em Etiquetas, abrir o grupo e a tela padrão de impressão; ao clicar em um subtópico, abrir diretamente essa função.
- Remover a navegação interna duplicada da tela de Etiquetas, deixando todo o espaço para o conteúdo.
- Manter Dashboard, Fila, Reservas, Clientes, Relatórios, Checklist e Configurações sem mudanças de funcionamento.
- Mostrar esse grupo somente quando o módulo Etiquetas estiver contratado e respeitar o menu recolhido e o celular.

## Detalhes técnicos
- Usar parâmetros na URL para preservar a aba ativa e permitir links diretos sem criar páginas ou duplicar funcionalidades.
- Reutilizar a tela e os componentes atuais de Etiquetas; nenhuma regra de negócio será alterada.
- Validar compilação e navegação em computador e celular.
