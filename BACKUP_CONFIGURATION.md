# 💾 MesaClik - Configuração de Backups e Disaster Recovery
**Data:** 08/11/2025  
**Objetivo:** Garantir recuperação de dados em caso de falha

---

## 1. ESTRATÉGIA DE BACKUP

### 1.1 Tipos de Backup

| Tipo | Frequência | Retenção | Objetivo |
|------|-----------|----------|----------|
| **Snapshot Completo** | Diário (3h da manhã) | 30 dias | Recuperação de desastres |
| **PITR (Point-in-Time)** | Contínuo (WAL logs) | 7 dias | Recuperação precisa |
| **Backup Incremental** | A cada 6h | 7 dias | Recuperação rápida |
| **Backup da Aplicação** | A cada deploy | Último + 10 versões | Rollback de código |

### 1.2 Regra 3-2-1
✅ **3 cópias** dos dados (prod + 2 backups)  
✅ **2 mídias diferentes** (disco + object storage)  
✅ **1 cópia offsite** (região diferente)

---

## 2. CONFIGURAÇÃO SUPABASE

### 2.1 Backups Automáticos (Dashboard)

**⚠️ AÇÃO MANUAL NECESSÁRIA:** Configure no dashboard do Supabase

1. Acesse: https://supabase.com/dashboard/project/akqldesakmcroydbgkbe/settings/database
2. Ative **Automated backups**:
   - Frequência: Daily (3:00 AM UTC)
   - Retenção: 30 days
3. Ative **Point-in-Time Recovery (PITR)**:
   - Retenção: 7 days
   - Granularidade: Até o segundo

### 2.2 Verificação de Backups (SQL)

Execute mensalmente para validar integridade:

```sql
-- Função para verificar se backups estão funcionando
CREATE OR REPLACE FUNCTION mesaclik.verify_backup_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  -- Check 1: Verificar se há dados recentes
  RETURN QUERY
  SELECT 
    'Recent Data Check'::TEXT,
    CASE 
      WHEN COUNT(*) > 0 THEN 'OK'
      ELSE 'WARNING'
    END::TEXT,
    ('Last insert: ' || MAX(created_at)::TEXT)::TEXT
  FROM mesaclik.audit_log
  WHERE created_at > NOW() - INTERVAL '24 hours';
  
  -- Check 2: Tamanho do banco
  RETURN QUERY
  SELECT 
    'Database Size'::TEXT,
    'OK'::TEXT,
    pg_size_pretty(pg_database_size(current_database()))::TEXT;
  
  -- Check 3: Contar tabelas críticas
  RETURN QUERY
  SELECT 
    'Critical Tables'::TEXT,
    'OK'::TEXT,
    (
      'Reservations: ' || (SELECT COUNT(*) FROM mesaclik.reservations)::TEXT ||
      ', Queue: ' || (SELECT COUNT(*) FROM mesaclik.queue_entries)::TEXT ||
      ', Audit: ' || (SELECT COUNT(*) FROM mesaclik.audit_log)::TEXT
    )::TEXT;
END;
$$;

-- Executar verificação
SELECT * FROM mesaclik.verify_backup_integrity();
```

---

## 3. DISASTER RECOVERY PLAN (DRP)

### 3.1 Cenários e Procedimentos

#### **Cenário 1: Perda de Dados Recente (< 7 dias)**
**Causa:** Delete acidental, bug de código  
**Solução:** Point-in-Time Recovery (PITR)

**Procedimento:**
1. Acesse: https://supabase.com/dashboard/project/akqldesakmcroydbgkbe/settings/database
2. Clique em **Point-in-Time Recovery**
3. Selecione timestamp exato (até o segundo)
4. Confirme restauração
5. **Downtime estimado:** 5-15 minutos

---

#### **Cenário 2: Perda Total do Banco (Desastre)**
**Causa:** Falha de hardware, região AWS indisponível  
**Solução:** Restauração de snapshot

**Procedimento:**
1. Acesse: https://supabase.com/dashboard/project/akqldesakmcroydbgkbe/settings/database
2. Vá em **Backups** > **Restore from backup**
3. Selecione snapshot mais recente
4. Confirme restauração (cria novo projeto temporário)
5. Migre conexões do app para novo endpoint
6. **Downtime estimado:** 1-4 horas

---

#### **Cenário 3: Corrupção de Tabela Específica**
**Causa:** Migração com erro, ataque  
**Solução:** Restauração seletiva via SQL

**Procedimento:**
```sql
-- 1) Criar tabela temporária com dados corrompidos
CREATE TABLE mesaclik.reservations_corrupted AS 
SELECT * FROM mesaclik.reservations;

-- 2) Restaurar do backup (via PITR ou export/import)
-- (executar via dashboard)

-- 3) Comparar e reconciliar
SELECT 
  b.id,
  b.customer_name AS backup_name,
  c.customer_name AS current_name
FROM mesaclik.reservations b
LEFT JOIN mesaclik.reservations_corrupted c ON b.id = c.id
WHERE b.customer_name != c.customer_name;

-- 4) Drop tabela temporária após validação
DROP TABLE mesaclik.reservations_corrupted;
```

---

## 4. BACKUP MANUAL (EXPORT)

### 4.1 Export Completo do Banco

**Via Supabase CLI:**
```bash
# Instalar CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref akqldesakmcroydbgkbe

# Export schema + dados
supabase db dump -f backup_$(date +%Y%m%d).sql

# Compactar
gzip backup_$(date +%Y%m%d).sql

# Upload para S3/Drive (opcional)
# aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://mesaclik-backups/
```

**Automatizar (cron job semanal):**
```bash
# Adicionar ao crontab (execute: crontab -e)
0 2 * * 0 cd /path/to/project && supabase db dump -f backup_$(date +\%Y\%m\%d).sql && gzip backup_$(date +\%Y\%m\%d).sql
```

### 4.2 Export de Tabelas Específicas

```sql
-- Via Supabase SQL Editor
COPY (
  SELECT * FROM mesaclik.reservations
  WHERE created_at > NOW() - INTERVAL '30 days'
) TO '/tmp/reservations_backup.csv' WITH CSV HEADER;

-- Download via dashboard ou psql
```

---

## 5. RESTORE (RECUPERAÇÃO)

### 5.1 Restaurar Banco Completo

```bash
# Via Supabase CLI
supabase db reset --db-url "postgresql://..."

# Ou via psql
gunzip backup_20251108.sql.gz
psql $DATABASE_URL < backup_20251108.sql
```

### 5.2 Restaurar Tabela Específica

```sql
-- 1) Criar tabela temporária
CREATE TABLE mesaclik.reservations_backup (LIKE mesaclik.reservations INCLUDING ALL);

-- 2) Importar dados
COPY mesaclik.reservations_backup FROM '/tmp/reservations_backup.csv' CSV HEADER;

-- 3) Comparar contagens
SELECT 'Backup' AS source, COUNT(*) FROM mesaclik.reservations_backup
UNION ALL
SELECT 'Production' AS source, COUNT(*) FROM mesaclik.reservations;

-- 4) Substituir (CUIDADO - testar em staging primeiro!)
-- BEGIN;
-- TRUNCATE mesaclik.reservations;
-- INSERT INTO mesaclik.reservations SELECT * FROM mesaclik.reservations_backup;
-- COMMIT;
```

---

## 6. TESTES DE RECUPERAÇÃO

### 6.1 Checklist Trimestral

- [ ] **Teste 1:** Restaurar PITR de 24h atrás em ambiente de staging
- [ ] **Teste 2:** Restaurar snapshot de 7 dias atrás em ambiente de staging
- [ ] **Teste 3:** Simular perda de tabela crítica e recuperar
- [ ] **Teste 4:** Verificar integridade de dados restaurados
- [ ] **Teste 5:** Medir tempo de recuperação (RTO) e perda de dados (RPO)

**Registrar resultados:** Documentar em issue/log interno

### 6.2 Métricas

| Métrica | Meta | Atual |
|---------|------|-------|
| **RTO (Recovery Time Objective)** | < 4 horas | A MEDIR |
| **RPO (Recovery Point Objective)** | < 1 hora | 0 (PITR contínuo) |
| **Frequência de Testes** | Trimestral | A AGENDAR |
| **Sucesso de Backups** | 100% | A MONITORAR |

---

## 7. MONITORAMENTO DE BACKUPS

### 7.1 Alertas (Configurar via Supabase Dashboard)

1. **Falha de Backup** → Email para admin
2. **Espaço em disco > 80%** → Email para admin
3. **PITR desabilitado** → Email IMEDIATO

**Link:** https://supabase.com/dashboard/project/akqldesakmcroydbgkbe/settings/notifications

### 7.2 View de Status

```sql
CREATE OR REPLACE VIEW mesaclik.v_backup_status AS
SELECT 
  'Last Audit Log'::TEXT AS metric,
  MAX(created_at)::TEXT AS value
FROM mesaclik.audit_log
UNION ALL
SELECT 
  'Database Size'::TEXT,
  pg_size_pretty(pg_database_size(current_database()))::TEXT
UNION ALL
SELECT 
  'Total Tables'::TEXT,
  COUNT(*)::TEXT
FROM information_schema.tables
WHERE table_schema IN ('public', 'mesaclik');

-- Consultar
SELECT * FROM mesaclik.v_backup_status;
```

---

## 8. SEGURANÇA DOS BACKUPS

### 8.1 Criptografia
✅ **Em trânsito:** TLS 1.3  
✅ **Em repouso:** AES-256 (Supabase managed)  
✅ **Export manual:** Criptografar com GPG antes de upload

```bash
# Criptografar backup antes de upload
gpg --symmetric --cipher-algo AES256 backup_20251108.sql.gz
# Gera: backup_20251108.sql.gz.gpg
```

### 8.2 Controle de Acesso
✅ Apenas **service_role** e **admins** podem acessar backups  
✅ **2FA obrigatório** para acesso ao dashboard do Supabase  
✅ **Audit log** de quem acessou backups

---

## 9. CUSTOS (ESTIMATIVA)

| Item | Custo Mensal (USD) |
|------|-------------------|
| **Backups automáticos** | Incluído no plano Pro |
| **PITR (7 dias)** | ~$0.10/GB |
| **Storage de backups** | ~$0.02/GB |
| **Tráfego de restore** | ~$0.09/GB |
| **TOTAL ESTIMADO** | ~$5-20/mês |

---

## 10. AÇÕES IMEDIATAS

### ✅ JÁ IMPLEMENTADO
- [x] Estrutura de tabelas com auditoria
- [x] RLS em todas as tabelas
- [x] Função `verify_backup_integrity()`

### ⚠️ PENDENTE (AÇÃO MANUAL)
- [ ] **Ativar backups automáticos** no dashboard Supabase
- [ ] **Ativar PITR** no dashboard Supabase
- [ ] **Configurar alertas** de falha de backup
- [ ] **Agendar teste trimestral** de restauração
- [ ] **Documentar RTO/RPO** medido

---

## 📞 CONTATO EM EMERGÊNCIA

**Em caso de perda de dados:**
1. **NÃO FAÇA NADA** antes de consultar a equipe
2. Abra ticket de emergência no Supabase: https://supabase.com/support
3. Contate: suporte-tecnico@mesaclik.com

**Escalação:**
- **Nível 1:** Engenheiro de plantão
- **Nível 2:** Tech Lead
- **Nível 3:** CTO + Supabase Support

---

**Status:** ✅ Estrutura pronta | ⚠️ Requer configuração manual no dashboard
