import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmailLog {
  id: string;
  restaurant_id: string;
  customer_id: string | null;
  email: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  image_url: string | null;
  coupon_code: string | null;
  valid_until: string | null;
  sent_at: string | null;
  scheduled_for: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  provider_message_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEmailLogParams {
  restaurant_id: string;
  customer_id?: string;
  email: string;
  subject: string;
  body_html: string;
  body_text?: string;
  image_url?: string;
  coupon_code?: string;
  valid_until?: string;
  scheduled_for?: string;
}

export const useEmailLogs = (restaurantId?: string) => {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchEmailLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmailLogs((data || []) as EmailLog[]);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: "Erro ao carregar logs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createEmailLog = async (params: CreateEmailLogParams) => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .insert({
          ...params,
          status: 'queued',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Log criado",
        description: "Log de email criado com sucesso",
      });

      await fetchEmailLogs();
      return data;
    } catch (err) {
      const error = err as Error;
      toast({
        title: "Erro ao criar log",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateEmailLogStatus = async (
    id: string,
    status: EmailLog['status'],
    providerMessageId?: string,
    errorMessage?: string
  ) => {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (providerMessageId) {
        updates.provider_message_id = providerMessageId;
      }

      if (errorMessage) {
        updates.error_message = errorMessage;
      }

      if (status === 'sent' || status === 'delivered') {
        updates.sent_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('email_logs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchEmailLogs();
    } catch (err) {
      const error = err as Error;
      console.error("Error updating email log status:", error);
      throw error;
    }
  };

  useEffect(() => {
    fetchEmailLogs();
  }, [restaurantId]);

  return {
    emailLogs,
    loading,
    error,
    refetch: fetchEmailLogs,
    createEmailLog,
    updateEmailLogStatus,
  };
};
