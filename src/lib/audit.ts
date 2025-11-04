import { supabase } from '@/integrations/supabase/client';

type AuditAction = 'create' | 'update' | 'delete' | 'cancel' | 'confirm';
type AuditEntity = 'reservation' | 'promotion' | 'queue_entry';

interface AuditLogParams {
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  restaurantId: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export async function logAudit({
  entity,
  entityId,
  action,
  restaurantId,
  success,
  errorMessage,
  metadata = {}
}: AuditLogParams) {
  try {
    const payload = {
      entity,
      entity_id: entityId,
      action,
      restaurant_id: restaurantId,
      success,
      error_message: errorMessage,
      metadata,
      timestamp: new Date().toISOString(),
    };

    console.log('[Audit Log]', payload);

    // Se houver uma tabela de audit_logs no futuro, descomentar:
    // await supabase.from('audit_logs').insert(payload);
  } catch (err) {
    console.error('[Audit Log Error]', err);
    // Não lançar erro para não interromper fluxo principal
  }
}
