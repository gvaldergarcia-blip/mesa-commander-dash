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
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_visit_date: string | null
          marketing_opt_in: boolean
          name: string
          notes: string | null
          phone: string | null
          total_spent: number
          total_visits: number
          updated_at: string
          vip_status: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_visit_date?: string | null
          marketing_opt_in?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          total_spent?: number
          total_visits?: number
          updated_at?: string
          vip_status?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_visit_date?: string | null
          marketing_opt_in?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          total_spent?: number
          total_visits?: number
          updated_at?: string
          vip_status?: boolean
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          clicked_at: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          email: string
          error_message: string | null
          id: string
          opened_at: string | null
          promotion_id: string
          sent_at: string
          status: Database["public"]["Enums"]["email_status"]
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          promotion_id: string
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          promotion_id?: string
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
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
      reservations: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          notes: string | null
          party_size: number
          phone: string
          reservation_datetime: string
          restaurant_id: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          notes?: string | null
          party_size: number
          phone: string
          reservation_datetime: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string
          reservation_datetime?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_queue_entry: {
        Args:
          | { p_reason: string; p_ticket_id: string; p_user_id: string }
          | { p_reason: string; p_ticket_id: string; p_user_id: string }
        Returns: string
      }
      cancel_reservation: {
        Args:
          | {
              cancel_reason_param?: string
              canceled_by_param?: string
              reservation_id: string
            }
          | {
              p_cancel_reason?: string
              p_reservation_id: string
              p_user_id: string
            }
        Returns: Json
      }
      enter_queue: {
        Args: { p_party_size: number; p_restaurant_id: string }
        Returns: Database["public"]["Tables"]["queue_entries"]["Row"]
      }
      get_queue_position: {
        Args: { p_ticket_id: string }
        Returns: number
      }
      update_queue_entry_status: {
        Args: { p_entry_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
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
