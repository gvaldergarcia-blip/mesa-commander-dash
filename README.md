# MesaClik - Painel de Controle

Sistema completo de gestão para restaurantes com fila de espera, reservas, clientes e promoções em tempo real.

## 📱 Funcionalidades

### Dashboard Principal
- **Visão geral** com métricas em tempo real
- **Atividade recente** de fila e reservas  
- **Ações rápidas** para operações frequentes
- **Status da fila** com indicadores visuais

### 🔄 Fila de Espera
- Gestão completa da fila em tempo real
- Posicionamento automático dos clientes
- Sistema de prioridades (Normal, Alta, VIP)
- Tempo de espera estimado
- Ações rápidas: Chamar, Sentar, Cancelar

### 📅 Reservas  
- Agenda integrada com visões diária/semanal
- Status: Pendente, Confirmada, Sentada, Cancelada
- Controle de check-in
- Gestão de no-shows

### 👥 Clientes
- Base completa de clientes
- Histórico de visitas e preferências
- Segmentação por frequência (VIP, Regular, Novo)
- Sistema de marketing opt-in/opt-out
- Análise de valor do cliente (LTV)

### 📧 Promoções & Marketing
- Criação e gestão de campanhas
- Envio de emails segmentados
- Métricas de engajamento (abertura, cliques)
- ROI de campanhas
- Logs detalhados de envio

### 📊 Relatórios & Análises
- KPIs do negócio em tempo real
- Análise de conversão de reservas
- Performance da fila de espera  
- Segmentação de clientes
- ROI de marketing

## 🚀 Para começar

### Configuração do ambiente

1. **Clone e instale dependências:**
```bash
git clone <YOUR_GIT_URL>
cd mesaclik-painel
npm install
npm run dev
```

2. **Configure as variáveis de ambiente:**
   
Crie um arquivo `.env.local` com:
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_publica
SUPABASE_SERVICE_ROLE_KEY=sua_chave_servico  # server-only
RESEND_API_KEY=sua_chave_resend              # opcional para emails
```

⚠️ **IMPORTANTE**: Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no cliente!

### Integração com Supabase

Este painel foi desenvolvido para consumir dados de um schema Supabase existente. **NÃO** crie ou altere tabelas - apenas utilize os dados existentes.

**Schema necessário:**
- `restaurants` - Dados dos restaurantes
- `queue_entries` - Fila de espera 
- `reservations` - Sistema de reservas
- `customers` - Base de clientes
- `promotions` - Campanhas de marketing
- `emails_log` - Logs de envio de email

### Segurança (RLS)

- Todas as queries filtram por `restaurant_id`
- Row Level Security (RLS) deve estar ativo
- User metadata deve conter `current_restaurant_id`

## 🏗️ Arquitetura

### Frontend (React + Vite)
- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui  
- **Icons**: Lucide React
- **Routing**: React Router
- **State**: React Query para cache/sync

### Componentes principais:
```
src/
├── components/
│   ├── layout/          # Layout e sidebar
│   └── ui/             # Componentes reutilizáveis
├── pages/              # Páginas do dashboard  
└── lib/                # Utilities e configuração
```

### Integração Backend
- **Client-side**: `createBrowserClient()` com chaves públicas
- **Server-side**: `createServiceClient()` com service role  
- **Realtime**: Canais WebSocket para atualizações ao vivo

## 📋 Checklist de Deploy

- [ ] Configurar variáveis de ambiente
- [ ] Verificar RLS policies no Supabase
- [ ] Testar integração com dados reais
- [ ] Configurar domínio personalizado (opcional)
- [ ] Configurar RESEND_API_KEY para emails

## 🔐 Segurança

1. **Nunca** exponha service role key no frontend
2. Use RLS policies para isolamento por restaurante  
3. Valide `restaurant_id` em todas as operações
4. Sanitize inputs do usuário

## 📞 Suporte

Para dúvidas sobre integração ou configuração:
- Verifique se o schema Supabase está correto
- Confirme que as RLS policies estão ativas
- Teste a conexão com dados de exemplo

---

**Tecnologias**: React, Vite, TypeScript, Tailwind CSS, Supabase, shadcn/ui
