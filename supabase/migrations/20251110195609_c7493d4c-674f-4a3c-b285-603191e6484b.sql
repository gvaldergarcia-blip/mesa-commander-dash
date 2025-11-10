-- Criar tabela de logs de OTP
CREATE TABLE IF NOT EXISTS mesaclik.otp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact TEXT NOT NULL, -- email ou telefone
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'queue', 'reservation', 'profile')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'verified', 'expired')),
  code_hash TEXT, -- hash do código para segurança
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para buscar logs por contato
CREATE INDEX idx_otp_logs_contact ON mesaclik.otp_logs(contact);
CREATE INDEX idx_otp_logs_user_id ON mesaclik.otp_logs(user_id);
CREATE INDEX idx_otp_logs_expires_at ON mesaclik.otp_logs(expires_at);

-- RLS policies
ALTER TABLE mesaclik.otp_logs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver seus próprios logs
CREATE POLICY "otp_logs_select_own" ON mesaclik.otp_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sistema pode inserir logs
CREATE POLICY "otp_logs_insert_system" ON mesaclik.otp_logs
  FOR INSERT
  WITH CHECK (true);

-- Sistema pode atualizar logs
CREATE POLICY "otp_logs_update_system" ON mesaclik.otp_logs
  FOR UPDATE
  USING (true);

COMMENT ON TABLE mesaclik.otp_logs IS 'Registro de códigos OTP enviados via Twilio (email/SMS)';
COMMENT ON COLUMN mesaclik.otp_logs.code_hash IS 'Hash bcrypt do código para verificação segura';
COMMENT ON COLUMN mesaclik.otp_logs.attempts IS 'Número de tentativas de verificação do código';