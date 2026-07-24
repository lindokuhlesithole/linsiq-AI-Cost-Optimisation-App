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
      optimization_actions: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          metadata: Json
          notes: string | null
          optimization_id: string
          org_id: string
          savings_usd: number
          user_id: string | null
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          optimization_id: string
          org_id: string
          savings_usd?: number
          user_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          optimization_id?: string
          org_id?: string
          savings_usd?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "optimization_actions_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: false
            referencedRelation: "optimizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      optimizations: {
        Row: {
          affected_resources: Json
          applied_at: string | null
          confidence: string
          confidence_factors: Json
          confidence_rank: number | null
          confidence_summary: string
          created_at: string
          current_cost: number
          description: string
          id: string
          implementation_notes: string
          org_id: string
          projected_cost: number
          resource_id: string
          savings_breakdown: Json
          savings_usd: number
          service: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          affected_resources?: Json
          applied_at?: string | null
          confidence: string
          confidence_factors?: Json
          confidence_rank?: number | null
          confidence_summary?: string
          created_at?: string
          current_cost?: number
          description?: string
          id: string
          implementation_notes?: string
          org_id?: string
          projected_cost?: number
          resource_id: string
          savings_breakdown?: Json
          savings_usd?: number
          service: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          affected_resources?: Json
          applied_at?: string | null
          confidence?: string
          confidence_factors?: Json
          confidence_rank?: number | null
          confidence_summary?: string
          created_at?: string
          current_cost?: number
          description?: string
          id?: string
          implementation_notes?: string
          org_id?: string
          projected_cost?: number
          resource_id?: string
          savings_breakdown?: Json
          savings_usd?: number
          service?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimizations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      user_in_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
