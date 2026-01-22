import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export type AudienceFilter = {
  type: 'all' | 'vip' | 'active' | 'inactive' | 'custom';
  minVisits?: number;
  maxVisits?: number;
  sourceType?: 'queue' | 'reservation' | 'both';
};

export type Campaign = {
  id: string;
  restaurant_id: string;
  title: string;
  subject: string;
  message: string;
  cta_text: string | null;
  cta_url: string | null;
  coupon_code: string | null;
  expires_at: string | null;
  audience_filter: AudienceFilter;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  status: CampaignStatus;
  total_recipients: number;
  created_by: string | null;
};

export type CampaignRecipient = {
  id: string;
  campaign_id: string;
  restaurant_id: string;
  customer_id: string | null;
  customer_email: string;
  customer_name: string | null;
  sent_at: string | null;
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  error_message: string | null;
  opened_at: string | null;
  clicked_at: string | null;
};

export type CreateCampaignInput = {
  title: string;
  subject: string;
  message: string;
  cta_text?: string;
  cta_url?: string;
  coupon_code?: string;
  expires_at?: string;
  audience_filter?: AudienceFilter;
};

export function useRestaurantCampaigns(restaurantId: string = RESTAURANT_ID) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('restaurant_campaigns')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setCampaigns(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar campanhas';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Criar nova campanha
  const createCampaign = useCallback(async (input: CreateCampaignInput): Promise<Campaign | null> => {
    try {
      const { data, error: createError } = await supabase
        .from('restaurant_campaigns')
        .insert({
          restaurant_id: restaurantId,
          title: input.title,
          subject: input.subject,
          message: input.message,
          cta_text: input.cta_text || null,
          cta_url: input.cta_url || null,
          coupon_code: input.coupon_code || null,
          expires_at: input.expires_at || null,
          audience_filter: input.audience_filter || { type: 'all' },
          status: 'draft',
        })
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: 'Promoção criada',
        description: 'A promoção foi salva com sucesso.',
      });

      await fetchCampaigns();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar promoção';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [restaurantId, toast, fetchCampaigns]);

  // Enviar campanha
  const sendCampaign = useCallback(async (
    campaignId: string, 
    recipients: { email: string; name?: string; customerId?: string }[]
  ): Promise<boolean> => {
    try {
      // Atualizar status para "sending"
      await supabase
        .from('restaurant_campaigns')
        .update({ status: 'sending' })
        .eq('id', campaignId);

      // Inserir destinatários
      const recipientRecords = recipients.map(r => ({
        campaign_id: campaignId,
        restaurant_id: restaurantId,
        customer_id: r.customerId || null,
        customer_email: r.email,
        customer_name: r.name || null,
        delivery_status: 'pending' as const,
      }));

      const { error: recipientsError } = await supabase
        .from('restaurant_campaign_recipients')
        .insert(recipientRecords);

      if (recipientsError) throw recipientsError;

      // Buscar campanha para enviar e-mails
      const { data: campaign, error: campaignError } = await supabase
        .from('restaurant_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError) throw campaignError;

      // Chamar edge function para enviar e-mails
      const { error: sendError } = await supabase.functions.invoke('send-campaign-emails', {
        body: {
          campaign_id: campaignId,
          restaurant_id: restaurantId,
          subject: campaign.subject,
          message: campaign.message,
          cta_text: campaign.cta_text,
          cta_url: campaign.cta_url,
          coupon_code: campaign.coupon_code,
          expires_at: campaign.expires_at,
          recipients: recipientRecords.map(r => ({
            email: r.customer_email,
            name: r.customer_name,
          })),
        },
      });

      if (sendError) {
        // Marcar como falha
        await supabase
          .from('restaurant_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignId);
        throw sendError;
      }

      // Marcar como enviada
      await supabase
        .from('restaurant_campaigns')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString(),
          total_recipients: recipients.length,
        })
        .eq('id', campaignId);

      toast({
        title: 'Promoção enviada!',
        description: `E-mail enviado para ${recipients.length} destinatário(s).`,
      });

      await fetchCampaigns();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar promoção';
      toast({
        title: 'Erro no envio',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [restaurantId, toast, fetchCampaigns]);

  // Buscar destinatários de uma campanha
  const getCampaignRecipients = useCallback(async (campaignId: string): Promise<CampaignRecipient[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('restaurant_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false });

      if (fetchError) throw fetchError;
      return data || [];
    } catch (err) {
      console.error('Erro ao buscar destinatários:', err);
      return [];
    }
  }, []);

  // Estatísticas
  const getStats = useCallback(() => {
    const sent = campaigns.filter(c => c.status === 'sent');
    const totalRecipients = sent.reduce((sum, c) => sum + (c.total_recipients || 0), 0);
    
    return {
      totalCampaigns: campaigns.length,
      sentCampaigns: sent.length,
      draftCampaigns: campaigns.filter(c => c.status === 'draft').length,
      totalRecipients,
    };
  }, [campaigns]);

  return {
    campaigns,
    loading,
    error,
    refetch: fetchCampaigns,
    createCampaign,
    sendCampaign,
    getCampaignRecipients,
    getStats,
  };
}
