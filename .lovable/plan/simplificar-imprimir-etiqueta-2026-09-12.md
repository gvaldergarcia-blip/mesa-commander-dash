# Simplificar “Imprimir etiqueta”

## Objetivo
Deixar a tela rápida e vertical como a referência enviada, remover da interface os blocos e textos “Novo ciclo” e mostrar o molde real da etiqueta antes da impressão, inclusive no celular.

## Alterações
- Remover da tela de impressão o aviso, seleção e botão “Novo ciclo”, sem alterar as regras existentes de validade, renovação ou histórico.
- Transformar a seleção de produtos em uma lista vertical compacta, com busca no topo, nome, marca/fornecedor, conservação e local; o item escolhido terá destaque discreto.
- Manter o formulário de preenchimento simples após a escolha do produto, com campos atuais de lote, validade original, quantidade, responsável e número de etiquetas.
- Adicionar uma prévia 80×40 da etiqueta, atualizada conforme os campos são preenchidos e exibida imediatamente antes do botão de imprimir.
- No celular, organizar a ordem como: produto escolhido → informações → prévia da etiqueta → botão de impressão, sem rolagem lateral.
- Reutilizar as mesmas informações e a mesma hierarquia visual da etiqueta impressa para a prévia corresponder ao resultado final.

## Validação
- Conferir compilação e erros da tela.
- Testar a seleção do produto e a prévia em desktop e celular.
- Confirmar que “Novo ciclo” não aparece em “Imprimir etiqueta” e que nenhum fluxo existente foi recriado.

## Detalhes técnicos
- Alterações somente na apresentação do fluxo de impressão e no componente visual de prévia.
- Cores e estados continuarão usando os estilos globais do MesaClik.
- Nenhuma alteração de banco de dados, cadastro, cálculo de validade ou impressão física.
