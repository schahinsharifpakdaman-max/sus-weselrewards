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
      point_accounts: {
        Row: {
          balance: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          applied_delta: number
          booked_by: string | null
          comment: string | null
          created_at: string
          delta: number
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          occurred_at: string
          profile_id: string
          rule_id: string | null
        }
        Insert: {
          applied_delta?: number
          booked_by?: string | null
          comment?: string | null
          created_at?: string
          delta: number
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          occurred_at?: string
          profile_id: string
          rule_id?: string | null
        }
        Update: {
          applied_delta?: number
          booked_by?: string | null
          comment?: string | null
          created_at?: string
          delta?: number
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          occurred_at?: string
          profile_id?: string
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aufstieg_beteiligt: boolean
          created_at: string
          full_name: string
          id: string
          is_trainer: boolean
          status: Database["public"]["Enums"]["person_status"]
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aufstieg_beteiligt?: boolean
          created_at?: string
          full_name: string
          id?: string
          is_trainer?: boolean
          status?: Database["public"]["Enums"]["person_status"]
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aufstieg_beteiligt?: boolean
          created_at?: string
          full_name?: string
          id?: string
          is_trainer?: boolean
          status?: Database["public"]["Enums"]["person_status"]
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_catalog: {
        Row: {
          active: boolean
          admin_only: boolean
          created_at: string
          delta: number
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          admin_only?: boolean
          created_at?: string
          delta: number
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          admin_only?: boolean
          created_at?: string
          delta?: number
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      season_settings: {
        Row: {
          aufstiegstopf_euro: number
          max_premium_players_per_matchday: number
          point_account_cap: number
          point_account_start: number
          premium_deduction_per_missed_training: number
          premium_min_euro: number
          premium_per_ligapunkt: number
          season_id: string
          training_days_per_week: number
          updated_at: string
        }
        Insert: {
          aufstiegstopf_euro?: number
          max_premium_players_per_matchday?: number
          point_account_cap?: number
          point_account_start?: number
          premium_deduction_per_missed_training?: number
          premium_min_euro?: number
          premium_per_ligapunkt?: number
          season_id: string
          training_days_per_week?: number
          updated_at?: string
        }
        Update: {
          aufstiegstopf_euro?: number
          max_premium_players_per_matchday?: number
          point_account_cap?: number
          point_account_start?: number
          premium_deduction_per_missed_training?: number
          premium_min_euro?: number
          premium_per_ligapunkt?: number
          season_id?: string
          training_days_per_week?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_settings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "trainer" | "spieler"
      person_status: "aktiv" | "verletzt"
      transaction_kind:
        | "bonus"
        | "strafe"
        | "training_unentschuldigt"
        | "training_verspaetung"
        | "spiel_verspaetung"
        | "spiel_gelb"
        | "spiel_gelbrot"
        | "spiel_rot"
        | "storno"
        | "manuell"
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
      app_role: ["admin", "trainer", "spieler"],
      person_status: ["aktiv", "verletzt"],
      transaction_kind: [
        "bonus",
        "strafe",
        "training_unentschuldigt",
        "training_verspaetung",
        "spiel_verspaetung",
        "spiel_gelb",
        "spiel_gelbrot",
        "spiel_rot",
        "storno",
        "manuell",
      ],
    },
  },
} as const
