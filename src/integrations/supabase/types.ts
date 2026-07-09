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
      match_participations: {
        Row: {
          created_at: string
          gelb: boolean
          gelbrot: boolean
          id: string
          late_minutes: number
          match_id: string
          nominated: boolean
          premium_euro: number
          profile_id: string
          rot: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          gelb?: boolean
          gelbrot?: boolean
          id?: string
          late_minutes?: number
          match_id: string
          nominated?: boolean
          premium_euro?: number
          profile_id: string
          rot?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          gelb?: boolean
          gelbrot?: boolean
          id?: string
          late_minutes?: number
          match_id?: string
          nominated?: boolean
          premium_euro?: number
          profile_id?: string
          rot?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          closed: boolean
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          goals_against: number | null
          goals_for: number | null
          id: string
          is_home: boolean
          ligapunkte: number
          notes: string | null
          opponent: string
          scheduled_at: string
          season_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          closed?: boolean
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          goals_against?: number | null
          goals_for?: number | null
          id?: string
          is_home?: boolean
          ligapunkte?: number
          notes?: string | null
          opponent: string
          scheduled_at: string
          season_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          closed?: boolean
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          goals_against?: number | null
          goals_for?: number | null
          id?: string
          is_home?: boolean
          ligapunkte?: number
          notes?: string | null
          opponent?: string
          scheduled_at?: string
          season_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
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
      training_attendance: {
        Row: {
          created_at: string
          id: string
          late_minutes: number
          note: string | null
          profile_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          training_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          late_minutes?: number
          note?: string | null
          profile_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          training_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          late_minutes?: number
          note?: string | null
          profile_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          training_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attendance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          closed: boolean
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          scheduled_at: string
          season_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          closed?: boolean
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scheduled_at: string
          season_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          closed?: boolean
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scheduled_at?: string
          season_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      close_match: { Args: { _match_id: string }; Returns: undefined }
      close_training: { Args: { _training_id: string }; Returns: undefined }
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
      attendance_status:
        | "anwesend"
        | "entschuldigt"
        | "unentschuldigt"
        | "verspaetet"
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
      attendance_status: [
        "anwesend",
        "entschuldigt",
        "unentschuldigt",
        "verspaetet",
      ],
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
