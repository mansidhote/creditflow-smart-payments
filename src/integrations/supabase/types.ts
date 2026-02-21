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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          sent: boolean
          trigger_at: string
          type: Database["public"]["Enums"]["alert_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          sent?: boolean
          trigger_at: string
          type: Database["public"]["Enums"]["alert_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          sent?: boolean
          trigger_at?: string
          type?: Database["public"]["Enums"]["alert_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          discount_days: number | null
          discount_deadline: string | null
          discount_pct: number | null
          due_date: string
          id: string
          invoice_date: string
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          supplier_id: string
          terms: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          discount_days?: number | null
          discount_deadline?: string | null
          discount_pct?: number | null
          due_date: string
          id?: string
          invoice_date: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_id: string
          terms: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          discount_days?: number | null
          discount_deadline?: string | null
          discount_pct?: number | null
          due_date?: string
          id?: string
          invoice_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_id?: string
          terms?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paid: number
          discount_captured: number
          id: string
          invoice_id: string
          paid_at: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          discount_captured?: number
          id?: string
          invoice_id: string
          paid_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          discount_captured?: number
          id?: string
          invoice_id?: string
          paid_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string
          business_type: Database["public"]["Enums"]["business_type"]
          cash_balance: number
          created_at: string
          full_name: string
          id: string
          user_id: string
        }
        Insert: {
          business_name: string
          business_type?: Database["public"]["Enums"]["business_type"]
          cash_balance?: number
          created_at?: string
          full_name: string
          id?: string
          user_id: string
        }
        Update: {
          business_name?: string
          business_type?: Database["public"]["Enums"]["business_type"]
          cash_balance?: number
          created_at?: string
          full_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          category: Database["public"]["Enums"]["supplier_category"]
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["supplier_category"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["supplier_category"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_type:
        | "DUE_7_DAYS"
        | "DUE_3_DAYS"
        | "DUE_TODAY"
        | "DISCOUNT_EXPIRING"
      business_type:
        | "Wholesale"
        | "Retail"
        | "Manufacturing"
        | "Distribution"
        | "Other"
      invoice_status: "ACTIVE" | "DUE_SOON" | "OVERDUE" | "PAID"
      supplier_category:
        | "Raw Materials"
        | "Packaging"
        | "Electronics"
        | "Textiles"
        | "Chemicals"
        | "Food & Agri"
        | "Machinery"
        | "Other"
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
      alert_type: [
        "DUE_7_DAYS",
        "DUE_3_DAYS",
        "DUE_TODAY",
        "DISCOUNT_EXPIRING",
      ],
      business_type: [
        "Wholesale",
        "Retail",
        "Manufacturing",
        "Distribution",
        "Other",
      ],
      invoice_status: ["ACTIVE", "DUE_SOON", "OVERDUE", "PAID"],
      supplier_category: [
        "Raw Materials",
        "Packaging",
        "Electronics",
        "Textiles",
        "Chemicals",
        "Food & Agri",
        "Machinery",
        "Other",
      ],
    },
  },
} as const
