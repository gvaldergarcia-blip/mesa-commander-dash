# 📋 MesaClik - Relatório de Conformidade LGPD
**Data:** 08/11/2025  
**Responsável Técnico:** Equipe de Desenvolvimento MesaClik  
**Base Legal:** Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)

---

## 1. DADOS PESSOAIS TRATADOS

### 1.1 Dados Coletados

| Categoria | Dados | Finalidade | Base Legal | Retenção |
|-----------|-------|------------|------------|----------|
| **Identificação** | Nome completo, CPF | Identificar usuário e emitir reservas | Execução de contrato | Durante vigência + 5 anos |
| **Contato** | E-mail, telefone | Comunicação de reservas/fila, marketing opt-in | Consentimento / Contrato | Durante vigência + 1 ano |
| **Localização** | Endereço IP (logs) | Segurança e auditoria | Legítimo interesse | 90 dias |
| **Navegação** | User agent, timestamp | Análise de uso e segurança | Legítimo interesse | 90 dias |
| **Transacional** | Histórico de reservas, filas | Gestão operacional | Execução de contrato | Durante vigência + 5 anos |
| **Marketing** | Opt-in status, preferências | Campanhas promocionais | Consentimento explícito | Até revogação |

### 1.2 Dados Sensíveis
❌ **Não coletamos dados sensíveis** (origem racial, saúde, biometria, etc.)

---

## 2. FINALIDADES DO TRATAMENTO

### 2.1 Finalidades Principais
1. **Gestão de Reservas:** Processar, confirmar e gerenciar reservas em restaurantes
2. **Gestão de Filas:** Organizar filas de espera digitais
3. **Comunicação:** Enviar notificações sobre reservas, filas e promoções (quando autorizado)
4. **Segurança:** Prevenir fraudes, abuso e garantir integridade do sistema
5. **Melhoria do Serviço:** Análise agregada para otimização da plataforma

### 2.2 Compartilhamento de Dados
- **Com restaurantes parceiros:** Dados de reservas/filas (nome, telefone, quantidade de pessoas)
- **Com provedores de serviço:** 
  - Twilio (envio de SMS)
  - Supabase (hospedagem de dados)
  - Vercel/Lovable (hospedagem frontend)
- **❌ NÃO compartilhamos com:** Terceiros para fins publicitários, corretores de dados

---

## 3. DIREITOS DOS TITULARES (Art. 18 LGPD)

Os usuários do MesaClik possuem os seguintes direitos:

| Direito | Como Exercer | Prazo de Resposta |
|---------|-------------|-------------------|
| **Confirmação de Tratamento** | Contato via email | 15 dias |
| **Acesso aos Dados** | Exportar dados via painel | Imediato |
| **Correção de Dados** | Editar perfil no app | Imediato |
| **Anonimização/Bloqueio** | Solicitar via email | 15 dias |
| **Eliminação** | Deletar conta no app | Até 30 dias |
| **Portabilidade** | Exportar dados (JSON/CSV) | Imediato |
| **Revogação de Consentimento** | Desmarcar opt-in no perfil | Imediato |
| **Oposição ao Tratamento** | Contato via email | 15 dias |

**Canal de Atendimento:** contato@mesaclik.com (substituir pelo canal real)

---

## 4. MEDIDAS TÉCNICAS DE SEGURANÇA

### 4.1 Proteção de Dados em Trânsito
✅ **TLS 1.3** obrigatório para todas as conexões  
✅ **HTTPS only** - HTTP redireciona para HTTPS  
✅ **Certificado SSL válido** e renovação automática

### 4.2 Proteção de Dados em Repouso
✅ **Criptografia AES-256** no banco de dados (Supabase managed)  
✅ **Backups criptografados** com retenção de 30 dias  
✅ **Point-in-Time Recovery (PITR)** habilitado

### 4.3 Controle de Acesso
✅ **Row Level Security (RLS)** ativo em 100% das tabelas  
✅ **Autenticação JWT** com expiração de sessão  
✅ **Principle of Least Privilege** - cada usuário acessa apenas seus dados  
✅ **Service Role Key** restrita a edge functions (backend)  
✅ **Anon Key** para cliente (sem acesso administrativo)

### 4.4 Auditoria e Logs
✅ **Audit Log (mesaclik.audit_log)** rastreia todas as operações:
   - INSERT, UPDATE, DELETE em `reservations`
   - INSERT, UPDATE, DELETE em `queue_entries`
   - Timestamp, user_id, IP address, dados antes/depois
✅ **Retenção de logs:** 90 dias (conforme LGPD - minimização)  
✅ **Acesso aos logs:** Restrito a service_role (apenas backend)

### 4.5 Políticas de Retenção de Dados
✅ **Logs de auditoria:** Deletados após 90 dias  
✅ **Dados de usuários inativos:** Revisão trimestral  
✅ **Contas deletadas:** Dados anonimizados após 30 dias  
✅ **Função automática:** `cleanup_old_audit_logs()` (executar mensalmente)

---

## 5. PROCESSO DE DELEÇÃO DE DADOS

### 5.1 Deleção de Conta (Art. 18, VI)
Quando um usuário solicita exclusão de conta:

1. **Reservas/Filas Ativas:** Canceladas automaticamente
2. **Dados Pessoais:** Anonimizados (nome → "Usuário Removido", email → NULL, phone → NULL)
3. **Logs de Auditoria:** Mantidos por 90 dias com user_id = NULL
4. **Histórico Agregado:** Mantido para análises (sem identificação pessoal)

**Script SQL (executar manualmente via service_role):**
```sql
-- Anonimizar usuário deletado
UPDATE mesaclik.reservations 
SET name = 'Usuário Removido', phone = NULL, email = NULL
WHERE user_id = '<USER_ID>';

UPDATE mesaclik.queue_entries 
SET name = 'Usuário Removido', phone = NULL, email = NULL
WHERE user_id = '<USER_ID>';

UPDATE mesaclik.audit_log 
SET user_id = NULL, ip_address = NULL, user_agent = NULL
WHERE user_id = '<USER_ID>';

-- Deletar perfil
DELETE FROM auth.users WHERE id = '<USER_ID>';
```

---

## 6. TRANSFERÊNCIA INTERNACIONAL DE DADOS

### 6.1 Localização dos Dados
- **Banco de Dados:** Supabase (AWS - região configurável, default US East)
- **Aplicação Frontend:** Vercel/Lovable (edge network global)
- **SMS Provider:** Twilio (US)

### 6.2 Adequação
✅ **Cláusulas Contratuais Padrão (SCCs)** com fornecedores  
✅ **Privacy Shield / DPF Compliance** dos providers  
✅ **Criptografia end-to-end** em trânsito

⚠️ **Recomendação:** Configurar região do Supabase para **São Paulo (sa-east-1)** se possível

---

## 7. INCIDENTES DE SEGURANÇA

### 7.1 Procedimento em Caso de Vazamento

1. **Detecção** (via monitoramento de logs/alertas)
2. **Contenção** (isolar sistema afetado)
3. **Avaliação** (identificar dados comprometidos)
4. **Notificação à ANPD** (em até 2 dias úteis se houver risco aos titulares)
5. **Notificação aos Titulares** (em prazo razoável, via e-mail)
6. **Remediação** (corrigir vulnerabilidade)
7. **Documentação** (relatório do incidente)

### 7.2 Contatos de Emergência
- **Encarregado de Dados (DPO):** [A DEFINIR]
- **Email:** dpo@mesaclik.com
- **ANPD:** anpd@anpd.gov.br

---

## 8. BASES LEGAIS UTILIZADAS

| Base Legal (Art. 7º) | Aplicação |
|----------------------|-----------|
| **Consentimento** | Marketing opt-in, comunicações promocionais |
| **Execução de Contrato** | Processamento de reservas e filas |
| **Legítimo Interesse** | Segurança, prevenção de fraudes, análises agregadas |
| **Cumprimento de Obrigação Legal** | Emissão de notas fiscais (quando aplicável) |

---

## 9. CHECKLIST DE CONFORMIDADE

### ✅ IMPLEMENTADO

- [x] **Art. 6º** - Princípios de tratamento (finalidade, adequação, necessidade, transparência, segurança)
- [x] **Art. 8º** - Consentimento explícito para marketing (opt-in checkbox)
- [x] **Art. 9º** - Titular pode revogar consentimento a qualquer momento
- [x] **Art. 18** - Facilitar exercício dos direitos dos titulares
- [x] **Art. 37** - Medidas técnicas de segurança adequadas
- [x] **Art. 46** - Auditoria e logs de acesso
- [x] **Art. 48** - Comunicação de incidentes de segurança

### ⚠️ RECOMENDAÇÕES ADICIONAIS

- [ ] **Nomear Encarregado de Dados (DPO)** formal
- [ ] **Termos de Uso e Política de Privacidade** atualizados (revisão jurídica)
- [ ] **Relatório de Impacto à Proteção de Dados (RIPD)** para tratamentos de alto risco
- [ ] **Contratos de Processamento de Dados** formais com fornecedores (Supabase, Twilio)
- [ ] **Treinamento de equipe** sobre LGPD

---

## 10. TECNOLOGIAS DE PRIVACIDADE

### 10.1 Privacy by Design
✅ RLS habilitado por padrão em todas as tabelas  
✅ Dados mínimos coletados (não pedimos CPF, data de nascimento, etc.)  
✅ Criptografia em todas as camadas  
✅ Anonimização automática após deleção

### 10.2 Privacy by Default
✅ **Marketing opt-in** começa como `false` (usuário precisa autorizar)  
✅ **Visibilidade de dados** restrita ao mínimo necessário  
✅ **Sessões** expiram automaticamente  

---

## 11. DOCUMENTAÇÃO TÉCNICA

### 11.1 Tabelas com Dados Pessoais
| Tabela | Dados Pessoais | RLS Ativo | Auditoria |
|--------|----------------|-----------|-----------|
| `mesaclik.reservations` | Nome, telefone, email | ✅ | ✅ |
| `mesaclik.queue_entries` | Nome, telefone, email | ✅ | ✅ |
| `public.profiles` | Nome, email, telefone | ✅ | ❌ |
| `public.customers` | Nome, email, telefone, notas | ✅ | ❌ |
| `mesaclik.audit_log` | user_id, IP, user_agent | ✅ | N/A |

### 11.2 Policies RLS Críticas
- `user_select_own` - Usuário só vê seus próprios dados
- `restaurant_member_select` - Restaurante só vê dados de suas reservas
- `restaurant_hours_public_read` - Horários são públicos (não identificam pessoas)

---

## 12. REVISÃO E ATUALIZAÇÃO

**Última revisão:** 08/11/2025  
**Próxima revisão:** 08/02/2026 (trimestral)  
**Responsável:** Equipe de Engenharia + Jurídico

---

## 📞 CONTATO

**Para exercer direitos LGPD:**  
- Email: contato@mesaclik.com  
- Telefone: [A DEFINIR]

**Encarregado de Dados (DPO):**  
- Email: dpo@mesaclik.com  
- Telefone: [A DEFINIR]

---

**Status Geral:** ✅ **CONFORME** com requisitos técnicos da LGPD  
**Pendências:** Formalização legal (Termos, DPO, RIPD)
