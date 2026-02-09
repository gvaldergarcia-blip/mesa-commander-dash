export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_palpites: {
        Row: {
          action_allowed: boolean
          created_at: string
          cta_payload: Json | null
          cta_type: string | null
          customer_id: string | null
          id: string
          message: string
          priority: string
          restaurant_id: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          action_allowed?: boolean
          created_at?: string
          cta_payload?: Json | null
          cta_type?: string | null
          customer_id?: string | null
          id?: string
          message: string
          priority?: string
          restaurant_id: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          action_allowed?: boolean
          created_at?: string
          cta_payload?: Json | null
          cta_type?: string | null
          customer_id?: string | null
          id?: string
          message?: string
          priority?: string
          restaurant_id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          restaurant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          restaurant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          restaurant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clientes_restaurante: {
        Row: {
          created_at: string
          email: string
          id: string
          restaurante_id: string
          updated_at: string
          user_id: string
          visitas_concluidas: number
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          restaurante_id: string
          updated_at?: string
          user_id: string
          visitas_concluidas?: number
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          restaurante_id?: string
          updated_at?: string
          user_id?: string
          visitas_concluidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "clientes_restaurante_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      consentimentos_cliente: {
        Row: {
          aceitou_ofertas_email: boolean
          aceitou_politica_privacidade: boolean
          aceitou_termos_uso: boolean
          created_at: string
          data_consentimento: string | null
          email: string
          id: string
          restaurante_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aceitou_ofertas_email?: boolean
          aceitou_politica_privacidade?: boolean
          aceitou_termos_uso?: boolean
          created_at?: string
          data_consentimento?: string | null
          email: string
          id?: string
          restaurante_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aceitou_ofertas_email?: boolean
          aceitou_politica_privacidade?: boolean
          aceitou_termos_uso?: boolean
          created_at?: string
          data_consentimento?: string | null
          email?: string
          id?: string
          restaurante_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimentos_cliente_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_events: {
        Row: {
          created_at: string
          customer_id: string
          event_type: string
          id: string
          party_size: number | null
          queue_wait_minutes: number | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          event_type: string
          id?: string
          party_size?: number | null
          queue_wait_minutes?: number | null
          restaurant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          event_type?: string
          id?: string
          party_size?: number | null
          queue_wait_minutes?: number | null
          restaurant_id?: string
        }
        Relationships: []
      }
      customer_metrics: {
        Row: {
          avg_wait_minutes: number | null
          cancel_count: number
          customer_id: string
          id: string
          last_queue_wait_minutes: number | null
          last_visit_at: string | null
          no_show_count: number
          restaurant_id: string
          total_visits: number
          updated_at: string
          visits_last_30d: number
          visits_prev_30d: number
        }
        Insert: {
          avg_wait_minutes?: number | null
          cancel_count?: number
          customer_id: string
          id?: string
          last_queue_wait_minutes?: number | null
          last_visit_at?: string | null
          no_show_count?: number
          restaurant_id: string
          total_visits?: number
          updated_at?: string
          visits_last_30d?: number
          visits_prev_30d?: number
        }
        Update: {
          avg_wait_minutes?: number | null
          cancel_count?: number
          customer_id?: string
          id?: string
          last_queue_wait_minutes?: number | null
          last_visit_at?: string | null
          no_show_count?: number
          restaurant_id?: string
          total_visits?: number
          updated_at?: string
          visits_last_30d?: number
          visits_prev_30d?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          first_visit_at: string | null
          id: string
          last_visit_date: string | null
          marketing_opt_in: boolean
          marketing_opt_in_updated_at: string | null
          name: string
          notes: string | null
          phone: string | null
          queue_completed: number
          reservations_completed: number
          total_spent: number
          total_visits: number
          updated_at: string
          vip_status: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_visit_at?: string | null
          id?: string
          last_visit_date?: string | null
          marketing_opt_in?: boolean
          marketing_opt_in_updated_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          queue_completed?: number
          reservations_completed?: number
          total_spent?: number
          total_visits?: number
          updated_at?: string
          vip_status?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          first_visit_at?: string | null
          id?: string
          last_visit_date?: string | null
          marketing_opt_in?: boolean
          marketing_opt_in_updated_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          queue_completed?: number
          reservations_completed?: number
          total_spent?: number
          total_visits?: number
          updated_at?: string
          vip_status?: boolean
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          body_html: string
          body_text: string | null
          coupon_code: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          email: string
          error_message: string | null
          id: string
          image_url: string | null
          provider_message_id: string | null
          restaurant_id: string
          scheduled_for: string | null
          sent_at: string | null
          source: string | null
          status: string
          subject: string
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          coupon_code?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          email: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          provider_message_id?: string | null
          restaurant_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          source?: string | null
          status?: string
          subject: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          coupon_code?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          email?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          provider_message_id?: string | null
          restaurant_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          source?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences_audit: {
        Row: {
          action: string
          created_at: string | null
          customer_id: string
          id: string
          notes: string | null
          source: string
          who: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          source: string
          who?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          source?: string
          who?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_audit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      fila_entradas: {
        Row: {
          active: boolean
          called_at: string | null
          canceled_at: string | null
          created_at: string
          email: string
          finalized_at: string | null
          id: string
          party_size: number
          restaurante_id: string
          status: string
          user_id: string
        }
        Insert: {
          active?: boolean
          called_at?: string | null
          canceled_at?: string | null
          created_at?: string
          email: string
          finalized_at?: string | null
          id?: string
          party_size?: number
          restaurante_id: string
          status?: string
          user_id: string
        }
        Update: {
          active?: boolean
          called_at?: string | null
          canceled_at?: string | null
          created_at?: string
          email?: string
          finalized_at?: string | null
          id?: string
          party_size?: number
          restaurante_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fila_entradas_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_leads: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bairro: string
          capacity_range: string
          cep: string
          cidade: string
          cnpj: string
          complemento: string | null
          created_at: string
          cuisine_type: string
          current_system: string | null
          current_system_name: string | null
          id: string
          ip_address: string | null
          is_multi_unit: boolean
          marketing_consent: boolean
          marketing_consent_at: string | null
          modules_selected: string
          numero: string
          operational_contact_consent: boolean
          operational_contact_consent_at: string | null
          owner_email: string
          owner_name: string
          owner_whatsapp: string
          razao_social: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          restaurant_name: string
          rua: string
          status: string
          suggested_plan: string | null
          terms_accepted: boolean
          terms_accepted_at: string | null
          trial_end_at: string | null
          trial_start_at: string | null
          uf: string
          unit_count: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bairro: string
          capacity_range: string
          cep: string
          cidade: string
          cnpj: string
          complemento?: string | null
          created_at?: string
          cuisine_type: string
          current_system?: string | null
          current_system_name?: string | null
          id?: string
          ip_address?: string | null
          is_multi_unit?: boolean
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          modules_selected: string
          numero: string
          operational_contact_consent?: boolean
          operational_contact_consent_at?: string | null
          owner_email: string
          owner_name: string
          owner_whatsapp: string
          razao_social: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          restaurant_name: string
          rua: string
          status?: string
          suggested_plan?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          trial_end_at?: string | null
          trial_start_at?: string | null
          uf: string
          unit_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bairro?: string
          capacity_range?: string
          cep?: string
          cidade?: string
          cnpj?: string
          complemento?: string | null
          created_at?: string
          cuisine_type?: string
          current_system?: string | null
          current_system_name?: string | null
          id?: string
          ip_address?: string | null
          is_multi_unit?: boolean
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          modules_selected?: string
          numero?: string
          operational_contact_consent?: boolean
          operational_contact_consent_at?: string | null
          owner_email?: string
          owner_name?: string
          owner_whatsapp?: string
          razao_social?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          restaurant_name?: string
          rua?: string
          status?: string
          suggested_plan?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          trial_end_at?: string | null
          trial_start_at?: string | null
          uf?: string
          unit_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          audience_filter: string
          created_at: string
          description: string | null
          ends_at: string
          id: string
          restaurant_id: string
          starts_at: string
          status: Database["public"]["Enums"]["promotion_status"]
          title: string
          updated_at: string
        }
        Insert: {
          audience_filter?: string
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          restaurant_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["promotion_status"]
          title: string
          updated_at?: string
        }
        Update: {
          audience_filter?: string
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          restaurant_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_admin_logs: {
        Row: {
          action: string
          created_at: string
          entries_affected: number | null
          id: string
          metadata: Json | null
          performed_by: string
          restaurant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entries_affected?: number | null
          id?: string
          metadata?: Json | null
          performed_by: string
          restaurant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entries_affected?: number | null
          id?: string
          metadata?: Json | null
          performed_by?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_admin_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_entries: {
        Row: {
          called_at: string | null
          canceled_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          estimated_wait_time: number | null
          id: string
          notes: string | null
          party_size: number
          phone: string
          position_number: number | null
          priority: Database["public"]["Enums"]["queue_priority"]
          queue_id: string
          seated_at: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          called_at?: string | null
          canceled_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          estimated_wait_time?: number | null
          id?: string
          notes?: string | null
          party_size: number
          phone: string
          position_number?: number | null
          priority?: Database["public"]["Enums"]["queue_priority"]
          queue_id: string
          seated_at?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          called_at?: string | null
          canceled_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          estimated_wait_time?: number | null
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string
          position_number?: number | null
          priority?: Database["public"]["Enums"]["queue_priority"]
          queue_id?: string
          seated_at?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_settings: {
        Row: {
          avg_time_1_2: number
          avg_time_3_4: number
          avg_time_5_6: number
          avg_time_7_8: number
          created_at: string | null
          id: string
          max_party_size: number
          queue_capacity: number
          restaurant_id: string
          tolerance_minutes: number
          updated_at: string | null
        }
        Insert: {
          avg_time_1_2?: number
          avg_time_3_4?: number
          avg_time_5_6?: number
          avg_time_7_8?: number
          created_at?: string | null
          id?: string
          max_party_size?: number
          queue_capacity?: number
          restaurant_id: string
          tolerance_minutes?: number
          updated_at?: string | null
        }
        Update: {
          avg_time_1_2?: number
          avg_time_3_4?: number
          avg_time_5_6?: number
          avg_time_7_8?: number
          created_at?: string | null
          id?: string
          max_party_size?: number
          queue_capacity?: number
          restaurant_id?: string
          tolerance_minutes?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      queue_terms_consents: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string | null
          id: string
          privacy_version: string
          restaurant_id: string
          terms_accepted: boolean
          terms_accepted_at: string | null
          terms_version: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name?: string | null
          id?: string
          privacy_version?: string
          restaurant_id: string
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          terms_version?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          id?: string
          privacy_version?: string
          restaurant_id?: string
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          terms_version?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      queues: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queues_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_settings: {
        Row: {
          created_at: string | null
          id: string
          max_party_size: number
          restaurant_id: string
          tolerance_minutes: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_party_size?: number
          restaurant_id: string
          tolerance_minutes?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_party_size?: number
          restaurant_id?: string
          tolerance_minutes?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          id: string
          notes: string | null
          party_size: number
          phone: string | null
          reservation_datetime: string
          restaurant_id: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          notes?: string | null
          party_size: number
          phone?: string | null
          reservation_datetime: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          reservation_datetime?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_campaign_recipients: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          customer_email: string
          customer_id: string | null
          customer_name: string | null
          delivery_status: string
          error_message: string | null
          id: string
          opened_at: string | null
          restaurant_id: string
          sent_at: string | null
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          customer_email: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_status?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          restaurant_id: string
          sent_at?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          customer_email?: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_status?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          restaurant_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "restaurant_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "restaurant_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_campaign_recipients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_campaigns: {
        Row: {
          audience_filter: Json | null
          coupon_code: string | null
          created_at: string
          created_by: string | null
          cta_text: string | null
          cta_url: string | null
          expires_at: string | null
          id: string
          message: string
          restaurant_id: string
          sent_at: string | null
          status: string
          subject: string
          title: string
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          audience_filter?: Json | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          message: string
          restaurant_id: string
          sent_at?: string | null
          status?: string
          subject: string
          title: string
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          audience_filter?: Json | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          restaurant_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          title?: string
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_closures: {
        Row: {
          created_at: string | null
          date: string
          id: string
          reason: string | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          reason?: string | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          reason?: string | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_closures_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_customers: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          internal_notes: string | null
          last_seen_at: string
          marketing_optin: boolean
          marketing_optin_at: string | null
          restaurant_id: string
          status: string
          tags: string[] | null
          terms_accepted: boolean
          terms_accepted_at: string | null
          total_queue_visits: number
          total_reservation_visits: number
          total_visits: number | null
          updated_at: string
          vip: boolean
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          internal_notes?: string | null
          last_seen_at?: string
          marketing_optin?: boolean
          marketing_optin_at?: string | null
          restaurant_id: string
          status?: string
          tags?: string[] | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          total_queue_visits?: number
          total_reservation_visits?: number
          total_visits?: number | null
          updated_at?: string
          vip?: boolean
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          internal_notes?: string | null
          last_seen_at?: string
          marketing_optin?: boolean
          marketing_optin_at?: string | null
          restaurant_id?: string
          status?: string
          tags?: string[] | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          total_queue_visits?: number
          total_reservation_visits?: number
          total_visits?: number | null
          updated_at?: string
          vip?: boolean
        }
        Relationships: []
      }
      restaurant_hours: {
        Row: {
          close_time: string | null
          day_of_week: number | null
          id: number
          open_time: string | null
          restaurant_id: string | null
        }
        Insert: {
          close_time?: string | null
          day_of_week?: number | null
          id?: number
          open_time?: string | null
          restaurant_id?: string | null
        }
        Update: {
          close_time?: string | null
          day_of_week?: number | null
          id?: number
          open_time?: string | null
          restaurant_id?: string | null
        }
        Relationships: []
      }
      restaurant_marketing_optins: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string | null
          id: string
          marketing_optin: boolean
          marketing_optin_at: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name?: string | null
          id?: string
          marketing_optin?: boolean
          marketing_optin_at?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          id?: string
          marketing_optin?: boolean
          marketing_optin_at?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_members: {
        Row: {
          created_at: string | null
          restaurant_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          restaurant_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          restaurant_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      restaurant_special_dates: {
        Row: {
          close_time: string | null
          created_at: string | null
          date: string
          id: string
          open_time: string | null
          reason: string | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          close_time?: string | null
          created_at?: string | null
          date: string
          id?: string
          open_time?: string | null
          reason?: string | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          close_time?: string | null
          created_at?: string | null
          date?: string
          id?: string
          open_time?: string | null
          reason?: string | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_special_dates_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          about: string | null
          address: string | null
          address_line: string | null
          city: string | null
          created_at: string | null
          cuisine: Database["public"]["Enums"]["cuisine_enum"]
          has_queue: boolean | null
          has_reservation: boolean | null
          home_priority: number
          id: string
          image_url: string | null
          is_featured_both: boolean
          is_featured_novidades: boolean
          is_featured_queue: boolean
          is_featured_reservation: boolean
          menu_url: string | null
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          address?: string | null
          address_line?: string | null
          city?: string | null
          created_at?: string | null
          cuisine: Database["public"]["Enums"]["cuisine_enum"]
          has_queue?: boolean | null
          has_reservation?: boolean | null
          home_priority?: number
          id?: string
          image_url?: string | null
          is_featured_both?: boolean
          is_featured_novidades?: boolean
          is_featured_queue?: boolean
          is_featured_reservation?: boolean
          menu_url?: string | null
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          address?: string | null
          address_line?: string | null
          city?: string | null
          created_at?: string | null
          cuisine?: Database["public"]["Enums"]["cuisine_enum"]
          has_queue?: boolean | null
          has_reservation?: boolean | null
          home_priority?: number
          id?: string
          image_url?: string | null
          is_featured_both?: boolean
          is_featured_novidades?: boolean
          is_featured_queue?: boolean
          is_featured_reservation?: boolean
          menu_url?: string | null
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          external_customer_id: string | null
          external_provider: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json | null
          plan_type: string
          restaurant_id: string
          started_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          external_customer_id?: string | null
          external_provider?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          plan_type?: string
          restaurant_id: string
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          external_customer_id?: string | null
          external_provider?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          plan_type?: string
          restaurant_id?: string
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_insights: {
        Row: {
          action_allowed: boolean
          created_at: string
          customer_id: string
          dismissed: boolean
          dismissed_at: string | null
          id: string
          insight_type: string
          message: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          action_allowed?: boolean
          created_at?: string
          customer_id: string
          dismissed?: boolean
          dismissed_at?: string | null
          id?: string
          insight_type: string
          message: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          action_allowed?: boolean
          created_at?: string
          customer_id?: string
          dismissed?: boolean
          dismissed_at?: string | null
          id?: string
          insight_type?: string
          message?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          cta_custom: string | null
          cta_type: string | null
          duration: number
          error_message: string | null
          id: string
          image_urls: string[]
          location: string | null
          logo_url: string | null
          music_url: string | null
          promo_text: string | null
          restaurant_id: string
          restaurant_name: string
          status: string
          template: string
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cta_custom?: string | null
          cta_type?: string | null
          duration: number
          error_message?: string | null
          id?: string
          image_urls: string[]
          location?: string | null
          logo_url?: string | null
          music_url?: string | null
          promo_text?: string | null
          restaurant_id: string
          restaurant_name: string
          status?: string
          template: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cta_custom?: string | null
          cta_type?: string | null
          duration?: number
          error_message?: string | null
          id?: string
          image_urls?: string[]
          location?: string | null
          logo_url?: string | null
          music_url?: string | null
          promo_text?: string | null
          restaurant_id?: string
          restaurant_name?: string
          status?: string
          template?: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      video_usage: {
        Row: {
          created_at: string
          id: string
          month_year: string
          restaurant_id: string
          updated_at: string
          videos_generated: number
        }
        Insert: {
          created_at?: string
          id?: string
          month_year: string
          restaurant_id: string
          updated_at?: string
          videos_generated?: number
        }
        Update: {
          created_at?: string
          id?: string
          month_year?: string
          restaurant_id?: string
          updated_at?: string
          videos_generated?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_usage_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_my_queue_entry: {
        Args: { p_restaurante_id: string }
        Returns: Json
      }
      cancel_queue_entry:
        | {
            Args: { p_reason: string; p_ticket_id: string; p_user_id: string }
            Returns: string
          }
        | {
            Args: { p_reason: string; p_ticket_id: string; p_user_id: string }
            Returns: undefined
          }
      cancel_reservation:
        | {
            Args: {
              p_cancel_reason?: string
              p_reservation_id: string
              p_user_id: string
            }
            Returns: {
              canceled_at: string
              canceled_by: string
              id: string
              status: Database["public"]["Enums"]["reservation_status"]
            }[]
          }
        | {
            Args: {
              cancel_reason_param?: string
              canceled_by_param?: string
              reservation_id: string
            }
            Returns: Json
          }
      clear_queue: { Args: { p_restaurant_id: string }; Returns: Json }
      create_queue_entry_web: {
        Args: { p_party_size?: number; p_restaurante_id: string }
        Returns: Json
      }
      create_reservation_panel: {
        Args: {
          p_customer_email: string
          p_name: string
          p_notes?: string
          p_party_size: number
          p_reserved_for: string
          p_restaurant_id: string
        }
        Returns: Database["public"]["Tables"]["reservations"]["Row"]
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_user_data: { Args: { p_email: string }; Returns: Json }
      ensure_dev_test_restaurant: { Args: never; Returns: undefined }
      enter_queue: {
        Args: { p_party_size: number; p_restaurant_id: string }
        Returns: Database["public"]["Tables"]["queue_entries"]["Row"]
        SetofOptions: {
          from: "*"
          to: "queue_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_ai_palpites: {
        Args: { p_restaurant_id: string }
        Returns: number
      }
      get_customer_queue_history: {
        Args: { p_email?: string; p_phone?: string; p_restaurant_id: string }
        Returns: {
          called_at: string
          canceled_at: string
          created_at: string
          email: string
          id: string
          name: string
          party_size: number
          phone: string
          seated_at: string
          status: string
          wait_time_min: number
        }[]
      }
      get_customer_reservation_history: {
        Args: { p_email?: string; p_phone?: string; p_restaurant_id: string }
        Returns: {
          canceled_at: string
          completed_at: string
          confirmed_at: string
          created_at: string
          customer_email: string
          id: string
          name: string
          no_show_at: string
          party_size: number
          phone: string
          reserved_for: string
          status: string
        }[]
      }
      get_my_queue_status: { Args: { p_restaurante_id: string }; Returns: Json }
      get_queue_position: { Args: { p_ticket_id: string }; Returns: number }
      get_reports_queue_data: {
        Args: {
          p_end_date: string
          p_restaurant_id: string
          p_start_date: string
        }
        Returns: {
          called_at: string
          canceled_at: string
          created_at: string
          id: string
          party_size: number
          phone: string
          seated_at: string
          status: string
        }[]
      }
      get_reports_reservation_data: {
        Args: {
          p_end_date: string
          p_restaurant_id: string
          p_start_date: string
        }
        Returns: {
          canceled_at: string
          completed_at: string
          confirmed_at: string
          created_at: string
          id: string
          no_show_at: string
          party_size: number
          phone: string
          reserved_for: string
          status: string
        }[]
      }
      get_reservations_panel: {
        Args: { p_restaurant_id: string }
        Returns: {
          cancel_reason: string
          canceled_at: string
          canceled_by: string
          completed_at: string
          confirmed_at: string
          created_at: string
          customer_email: string
          id: string
          name: string
          no_show_at: string
          notes: string
          party_size: number
          phone: string
          reserved_for: string
          restaurant_id: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
          user_id: string
        }[]
      }
      get_restaurant_calendar: {
        Args: { p_restaurant_id: string }
        Returns: {
          created_at: string
          day: string
          is_open: boolean
          restaurant_id: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id?: string }; Returns: boolean }
      is_member_of: { Args: { p_restaurant_id: string }; Returns: boolean }
      is_member_or_admin: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      is_restaurant_authorized: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      is_restaurant_member: {
        Args: { p_restaurant_id: string; p_user_id?: string }
        Returns: boolean
      }
      rotate_customer_visits_monthly: { Args: never; Returns: undefined }
      toggle_restaurant_calendar_day: {
        Args: { p_day: string; p_is_open: boolean; p_restaurant_id: string }
        Returns: Json
      }
      update_consent: {
        Args: {
          p_aceitou_ofertas_email?: boolean
          p_aceitou_politica_privacidade?: boolean
          p_aceitou_termos_uso?: boolean
          p_restaurante_id: string
        }
        Returns: Json
      }
      update_queue_entry_status: {
        Args: { p_entry_id: string; p_status: string }
        Returns: undefined
      }
      update_reservation_status_panel: {
        Args: {
          p_cancel_reason?: string
          p_reservation_id: string
          p_status: Database["public"]["Enums"]["reservation_status"]
        }
        Returns: Json
      }
      upsert_customer_from_queue: {
        Args: { p_email?: string; p_name: string; p_phone: string }
        Returns: string
      }
      upsert_restaurant_customer: {
        Args: {
          p_email: string
          p_marketing_optin?: boolean
          p_name?: string
          p_phone?: string
          p_restaurant_id: string
          p_source?: string
          p_terms_accepted?: boolean
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "owner" | "manager" | "user"
      cuisine_enum:
        | "Brasileira"
        | "Italiana"
        | "Pizzaria"
        | "Hamburgueria"
        | "Japonesa"
        | "Oriental"
        | "Asiática"
        | "Mexicana"
        | "Saudável"
        | "Churrascaria"
        | "Cafeteria"
        | "Doceria"
        | "Francesa"
        | "Indiana"
        | "Tailandesa"
        | "Mediterrânea"
        | "Grega"
        | "Portuguesa"
        | "Espanhola"
        | "Alemã"
        | "Havaiana"
        | "Frutos do Mar"
        | "Steakhouse"
        | "Bar"
        | "Sorveteria"
        | "Padaria"
        | "Contemporânea"
        | "Argentina"
        | "Peruana"
        | "Uruguaia"
        | "Latino Americana"
        | "Outros"
        | "Cervejaria"
        | "Árabe"
      email_status:
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "failed"
      promotion_status:
        | "draft"
        | "scheduled"
        | "active"
        | "completed"
        | "canceled"
      queue_priority: "normal" | "high" | "vip"
      queue_status: "waiting" | "called" | "seated" | "canceled" | "no_show"
      reservation_status:
        | "pending"
        | "confirmed"
        | "seated"
        | "completed"
        | "canceled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "owner", "manager", "user"],
      cuisine_enum: [
        "Brasileira",
        "Italiana",
        "Pizzaria",
        "Hamburgueria",
        "Japonesa",
        "Oriental",
        "Asiática",
        "Mexicana",
        "Saudável",
        "Churrascaria",
        "Cafeteria",
        "Doceria",
        "Francesa",
        "Indiana",
        "Tailandesa",
        "Mediterrânea",
        "Grega",
        "Portuguesa",
        "Espanhola",
        "Alemã",
        "Havaiana",
        "Frutos do Mar",
        "Steakhouse",
        "Bar",
        "Sorveteria",
        "Padaria",
        "Contemporânea",
        "Argentina",
        "Peruana",
        "Uruguaia",
        "Latino Americana",
        "Outros",
        "Cervejaria",
        "Árabe",
      ],
      email_status: [
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "failed",
      ],
      promotion_status: [
        "draft",
        "scheduled",
        "active",
        "completed",
        "canceled",
      ],
      queue_priority: ["normal", "high", "vip"],
      queue_status: ["waiting", "called", "seated", "canceled", "no_show"],
      reservation_status: [
        "pending",
        "confirmed",
        "seated",
        "completed",
        "canceled",
      ],
    },
  },
} as const
