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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activities: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string
          customer_id: string
          due_at: string | null
          id: string
          next_task: string | null
          notes: string | null
          occurred_at: string
          organization_id: string
          outcome: string | null
          subject: string | null
          task_done_at: string | null
          updated_at: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by: string
          customer_id: string
          due_at?: string | null
          id?: string
          next_task?: string | null
          notes?: string | null
          occurred_at?: string
          organization_id: string
          outcome?: string | null
          subject?: string | null
          task_done_at?: string | null
          updated_at?: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          due_at?: string | null
          id?: string
          next_task?: string | null
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          outcome?: string | null
          subject?: string | null
          task_done_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          customer_id: string
          floor: string | null
          gps: string | null
          hours: string | null
          id: string
          notes: string | null
          organization_id: string
          postal: string | null
          room: string | null
          site_name: string | null
          sort_order: number
          street: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id: string
          floor?: string | null
          gps?: string | null
          hours?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          postal?: string | null
          room?: string | null
          site_name?: string | null
          sort_order?: number
          street?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string
          floor?: string | null
          gps?: string | null
          hours?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          postal?: string | null
          room?: string | null
          site_name?: string | null
          sort_order?: number
          street?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_commercial: {
        Row: {
          created_at: string
          customer_id: string
          data: Json
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          data?: Json
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          data?: Json
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_commercial_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_commercial_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          availability: string | null
          created_at: string
          customer_id: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          is_primary: boolean
          language: string | null
          mobile: string | null
          notifications: boolean
          organization_id: string
          phone: string | null
          role: string | null
          sort_order: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          availability?: string | null
          created_at?: string
          customer_id: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_primary?: boolean
          language?: string | null
          mobile?: string | null
          notifications?: boolean
          organization_id: string
          phone?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          availability?: string | null
          created_at?: string
          customer_id?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_primary?: boolean
          language?: string | null
          mobile?: string | null
          notifications?: boolean
          organization_id?: string
          phone?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_manager: string | null
          company_id: string | null
          company_name: string
          company_type: string | null
          created_at: string
          created_by: string
          customer_code: string
          finance_manager: string | null
          id: string
          industry: string | null
          logo_url: string | null
          ops_manager: string | null
          organization_id: string
          sales_rep: string | null
          sector: string | null
          service_rep: string | null
          status: Database["public"]["Enums"]["customer_status"]
          trade_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager?: string | null
          company_id?: string | null
          company_name: string
          company_type?: string | null
          created_at?: string
          created_by: string
          customer_code: string
          finance_manager?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          ops_manager?: string | null
          organization_id: string
          sales_rep?: string | null
          sector?: string | null
          service_rep?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager?: string | null
          company_id?: string | null
          company_name?: string
          company_type?: string | null
          created_at?: string
          created_by?: string
          customer_code?: string
          finance_manager?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          ops_manager?: string | null
          organization_id?: string
          sales_rep?: string | null
          sector?: string | null
          service_rep?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_calculation_log: {
        Row: {
          breakdown: Json
          calculated_price: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          execution_time_ms: number | null
          id: string
          inputs: Json
          organization_id: string
          pricing_version: number | null
          quotation_id: string | null
          rule_id: string | null
          rule_used: string | null
        }
        Insert: {
          breakdown?: Json
          calculated_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          execution_time_ms?: number | null
          id?: string
          inputs?: Json
          organization_id: string
          pricing_version?: number | null
          quotation_id?: string | null
          rule_id?: string | null
          rule_used?: string | null
        }
        Update: {
          breakdown?: Json
          calculated_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          execution_time_ms?: number | null
          id?: string
          inputs?: Json
          organization_id?: string
          pricing_version?: number | null
          quotation_id?: string | null
          rule_id?: string | null
          rule_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_calculation_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_calculation_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_calculation_log_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_calculation_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          base_price: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          destination_airport: string | null
          destination_country: string | null
          effective_from: string | null
          effective_to: string | null
          fuel_surcharge_pct: number
          id: string
          incoterm: string | null
          insurance_pct: number
          minimum_charge: number
          name: string
          organization_id: string
          origin_airport: string | null
          origin_country: string | null
          packaging: string | null
          priority: number
          published_at: string | null
          rate: number
          service_type: string | null
          shipment_type: string | null
          status: string
          tax_pct: number
          temperature_range: string | null
          unit: string
          updated_at: string
          version: number
          weight_from: number | null
          weight_to: number | null
        }
        Insert: {
          base_price?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          destination_airport?: string | null
          destination_country?: string | null
          effective_from?: string | null
          effective_to?: string | null
          fuel_surcharge_pct?: number
          id?: string
          incoterm?: string | null
          insurance_pct?: number
          minimum_charge?: number
          name: string
          organization_id: string
          origin_airport?: string | null
          origin_country?: string | null
          packaging?: string | null
          priority?: number
          published_at?: string | null
          rate?: number
          service_type?: string | null
          shipment_type?: string | null
          status?: string
          tax_pct?: number
          temperature_range?: string | null
          unit?: string
          updated_at?: string
          version?: number
          weight_from?: number | null
          weight_to?: number | null
        }
        Update: {
          base_price?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          destination_airport?: string | null
          destination_country?: string | null
          effective_from?: string | null
          effective_to?: string | null
          fuel_surcharge_pct?: number
          id?: string
          incoterm?: string | null
          insurance_pct?: number
          minimum_charge?: number
          name?: string
          organization_id?: string
          origin_airport?: string | null
          origin_country?: string | null
          packaging?: string | null
          priority?: number
          published_at?: string | null
          rate?: number
          service_type?: string | null
          shipment_type?: string | null
          status?: string
          tax_pct?: number
          temperature_range?: string | null
          unit?: string
          updated_at?: string
          version?: number
          weight_from?: number | null
          weight_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          agent: string | null
          airline: string | null
          arrive_date: string | null
          created_at: string
          created_by: string
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          customer_ref: string | null
          depart_date: string | null
          dest_port: string | null
          id: string
          incoterm: string | null
          margin_pct: number | null
          organization_id: string
          origin_port: string | null
          payload: Json
          quote_code: string
          shipment_kind: string | null
          shipment_mode: Database["public"]["Enums"]["shipment_mode"]
          status: Database["public"]["Enums"]["quote_status"]
          total: number | null
          transit_ports: string[]
          updated_at: string
        }
        Insert: {
          agent?: string | null
          airline?: string | null
          arrive_date?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_ref?: string | null
          depart_date?: string | null
          dest_port?: string | null
          id?: string
          incoterm?: string | null
          margin_pct?: number | null
          organization_id: string
          origin_port?: string | null
          payload?: Json
          quote_code: string
          shipment_kind?: string | null
          shipment_mode?: Database["public"]["Enums"]["shipment_mode"]
          status?: Database["public"]["Enums"]["quote_status"]
          total?: number | null
          transit_ports?: string[]
          updated_at?: string
        }
        Update: {
          agent?: string | null
          airline?: string | null
          arrive_date?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_ref?: string | null
          depart_date?: string | null
          dest_port?: string | null
          id?: string
          incoterm?: string | null
          margin_pct?: number | null
          organization_id?: string
          origin_port?: string | null
          payload?: Json
          quote_code?: string
          shipment_kind?: string | null
          shipment_mode?: Database["public"]["Enums"]["shipment_mode"]
          status?: Database["public"]["Enums"]["quote_status"]
          total?: number | null
          transit_ports?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          created_at: string
          created_by: string | null
          destination: string
          id: string
          notes: string | null
          organization_id: string
          origin: string
          reference_code: string
          status: Database["public"]["Enums"]["shipment_status"]
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination: string
          id?: string
          notes?: string | null
          organization_id: string
          origin: string
          reference_code: string
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination?: string
          id?: string
          notes?: string | null
          organization_id?: string
          origin?: string
          reference_code?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_org_code: { Args: never; Returns: string }
      get_user_org: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      customer_status: "active" | "inactive" | "frozen" | "lead" | "lost"
      quote_status: "draft" | "sent" | "approved" | "rejected" | "expired"
      shipment_mode: "direct" | "console" | "transship"
      shipment_status: "pending" | "in_transit" | "delivered" | "cancelled"
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
      app_role: ["admin", "member"],
      customer_status: ["active", "inactive", "frozen", "lead", "lost"],
      quote_status: ["draft", "sent", "approved", "rejected", "expired"],
      shipment_mode: ["direct", "console", "transship"],
      shipment_status: ["pending", "in_transit", "delivered", "cancelled"],
    },
  },
} as const
