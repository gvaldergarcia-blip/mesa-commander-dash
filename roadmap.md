# Roadmap

- [ ] Corrigir largura da tela QR e manter exclusivamente baixa por uso.
- [ ] Garantir baixa por vencimento da validade original sobre todo saldo do lote e impedir renovação vencida no servidor.
- [ ] Validar consumo exato, testes de regras e apresentação mobile; leitura/gravação autenticada depende de sessão externa.

- [x] Conferir exclusão de validade original vencida: cinco testes passaram; resolução unificada entre Renovação e Dashboard, incluindo validade mais antiga do ciclo. Conta real não verificada por autenticação externa.
- [x] Alinhar prévia ao modelo realmente impresso, sem QR Code, preservando a impressão final; conferida com dados fictícios em 320/390/579/1280 px.

- [x] Remover prazo pós-abertura automático do cadastro no recebimento; 8 testes passaram e formulário mobile conferido com produtos fictícios: nenhum envio sem prazo, valores informados preservados. Gravação em conta real indisponível por autenticação externa.

- [x] Atualizar saldo e histórico após Só computar; exigir lote e validade original em todos os produtos para imprimir com aviso visível. Quatro testes passaram e bloqueio/liberação conferidos com 12 produtos fictícios; gravação em conta real não verificada por ausência de sessão disponível.

- [x] Compactar Recebimento no celular com um produto por vez e campos pareados; seleção e edição verificadas com nota fictícia em 320/375/390/430/579 px e desktop, sem alterar operações.

- [x] Corrigir erro "Cannot read properties of null (reading 'useRef')" (React duplicado no Vite)
- [x] Validade da etiqueta = min(manipulação + pós-abertura cadastrada, validade original), fim do dia 23:59 — FastPrintTab
- [x] Levar os subtópicos de Etiquetas para um grupo expansível no menu principal
- [x] Transformar o Dashboard de Etiquetas em central operacional com quatro atalhos
- [x] Simplificar Imprimir etiqueta com lista vertical e prévia 80×40 antes da impressão
- [x] Compactar o Dashboard de Etiquetas e otimizar sua leitura e fluidez no celular
- [x] Corrigir erros de verificação da prévia
- [x] Fase 1: criar shell mobile do módulo Etiquetas com contexto e navegação sempre visíveis
- [x] Fase 2: adaptar Dashboard e Imprimir etiqueta para fluxos mobile próprios
- [x] Fase 2: adaptar Renovação e Recebimento para telas operacionais mobile
- [x] Fase 2: adaptar Cadastro, Estoque e Funcionários para listas e formulários mobile
- [x] Validar estruturalmente 320/375/390/430 px, tablet e desktop sem regressões de compilação
- [x] Implementar e validar navegação inferior, tela Hoje e compactação mobile de Etiquetas
- [ ] Fase 3: replicar o padrão aprovado nos demais módulos após validação de Etiquetas
