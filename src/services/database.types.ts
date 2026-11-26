// Gerado a partir do banco do Supabase (generate_typescript_types). Não edite à mão:
// gere de novo sempre que uma migration mudar o banco.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      adjustments: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          game_id: string
          game_player_id: string
          id: string
          reason: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          game_id: string
          game_player_id: string
          id?: string
          reason: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          game_id?: string
          game_player_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_game_player_fk"
            columns: ["game_player_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id", "game_id"]
          },
          {
            foreignKeyName: "adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      buyins: {
        Row: {
          amount_cents: number
          chips: number | null
          created_at: string
          created_by: string | null
          game_id: string
          game_player_id: string
          id: string
          kind: string
        }
        Insert: {
          amount_cents: number
          chips?: number | null
          created_at?: string
          created_by?: string | null
          game_id: string
          game_player_id: string
          id?: string
          kind: string
        }
        Update: {
          amount_cents?: number
          chips?: number | null
          created_at?: string
          created_by?: string | null
          game_id?: string
          game_player_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyins_game_player_id_game_id_fkey"
            columns: ["game_player_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      chip_counts: {
        Row: {
          denomination_id: string
          game_id: string
          game_player_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          denomination_id: string
          game_id: string
          game_player_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          denomination_id?: string
          game_id?: string
          game_player_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_counts_denomination_id_fkey"
            columns: ["denomination_id"]
            isOneToOne: false
            referencedRelation: "chip_denominations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_counts_game_player_id_game_id_fkey"
            columns: ["game_player_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      chip_denominations: {
        Row: {
          color: string
          id: string
          kit_id: string
          position: number
          quantity: number
          value: number
        }
        Insert: {
          color: string
          id?: string
          kit_id: string
          position?: number
          quantity: number
          value: number
        }
        Update: {
          color?: string
          id?: string
          kit_id?: string
          position?: number
          quantity?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "chip_denominations_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "chip_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_kits: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_kits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_kits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      eliminations: {
        Row: {
          created_at: string
          eliminated_by: string | null
          game_id: string
          game_player_id: string
          id: string
          position: number
        }
        Insert: {
          created_at?: string
          eliminated_by?: string | null
          game_id: string
          game_player_id: string
          id?: string
          position: number
        }
        Update: {
          created_at?: string
          eliminated_by?: string | null
          game_id?: string
          game_player_id?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "eliminations_eliminated_by_game_id_fkey"
            columns: ["eliminated_by", "game_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id", "game_id"]
          },
          {
            foreignKeyName: "eliminations_game_player_id_game_id_fkey"
            columns: ["game_player_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      game_players: {
        Row: {
          counted_cents: number | null
          created_at: string
          finish_position: number | null
          game_id: string
          id: string
          player_id: string
        }
        Insert: {
          counted_cents?: number | null
          created_at?: string
          finish_position?: number | null
          game_id: string
          id?: string
          player_id: string
        }
        Update: {
          counted_cents?: number | null
          created_at?: string
          finish_position?: number | null
          game_id?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          current_level: number | null
          finished_at: string | null
          group_id: string
          host_id: string | null
          id: string
          kit_id: string | null
          level_started_at: string | null
          panel_code: string
          paused_at: string | null
          settings: Json
          started_at: string | null
          status: string
          structure_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_level?: number | null
          finished_at?: string | null
          group_id: string
          host_id?: string | null
          id?: string
          kit_id?: string | null
          level_started_at?: string | null
          panel_code?: string
          paused_at?: string | null
          settings?: Json
          started_at?: string | null
          status?: string
          structure_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_level?: number | null
          finished_at?: string | null
          group_id?: string
          host_id?: string | null
          id?: string
          kit_id?: string | null
          level_started_at?: string | null
          panel_code?: string
          paused_at?: string | null
          settings?: Json
          started_at?: string | null
          status?: string
          structure_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_kit_id_group_id_fkey"
            columns: ["kit_id", "group_id"]
            isOneToOne: false
            referencedRelation: "chip_kits"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "games_structure_id_group_id_fkey"
            columns: ["structure_id", "group_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          default_cash_kit_id: string | null
          default_tournament_kit_id: string | null
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_cash_kit_id?: string | null
          default_tournament_kit_id?: string | null
          id?: string
          invite_code?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_cash_kit_id?: string | null
          default_tournament_kit_id?: string | null
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_default_cash_kit_fk"
            columns: ["default_cash_kit_id", "id"]
            isOneToOne: false
            referencedRelation: "chip_kits"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "groups_default_tournament_kit_fk"
            columns: ["default_tournament_kit_id", "id"]
            isOneToOne: false
            referencedRelation: "chip_kits"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      levels: {
        Row: {
          ante: number
          big_blind: number | null
          color_up: string | null
          duration_minutes: number
          id: string
          is_break: boolean
          position: number
          small_blind: number | null
          structure_id: string
        }
        Insert: {
          ante?: number
          big_blind?: number | null
          color_up?: string | null
          duration_minutes: number
          id?: string
          is_break?: boolean
          position: number
          small_blind?: number | null
          structure_id: string
        }
        Update: {
          ante?: number
          big_blind?: number | null
          color_up?: string | null
          duration_minutes?: number
          id?: string
          is_break?: boolean
          position?: number
          small_blind?: number | null
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          archived_at: string | null
          created_at: string
          group_id: string
          id: string
          name: string
          pix_key: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          group_id: string
          id?: string
          name: string
          pix_key?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          pix_key?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          display_name: string
          id: string
          pix_key: string | null
          public_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name: string
          id: string
          pix_key?: string | null
          public_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          id?: string
          pix_key?: string | null
          public_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seats: {
        Row: {
          game_id: string
          game_player_id: string
          id: string
          seat_number: number
          table_id: string
        }
        Insert: {
          game_id: string
          game_player_id: string
          id?: string
          seat_number: number
          table_id: string
        }
        Update: {
          game_id?: string
          game_player_id?: string
          id?: string
          seat_number?: number
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_game_player_id_game_id_fkey"
            columns: ["game_player_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id", "game_id"]
          },
          {
            foreignKeyName: "seats_table_id_game_id_fkey"
            columns: ["table_id", "game_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount_cents: number
          created_at: string
          from_player_id: string
          game_id: string
          id: string
          paid_at: string | null
          received_at: string | null
          to_player_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          from_player_id: string
          game_id: string
          id?: string
          paid_at?: string | null
          received_at?: string | null
          to_player_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          from_player_id?: string
          game_id?: string
          id?: string
          paid_at?: string | null
          received_at?: string | null
          to_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_from_player_id_fkey"
            columns: ["from_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_player_id_fkey"
            columns: ["to_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      structures: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          is_saved: boolean
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          is_saved?: boolean
          name: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          is_saved?: boolean
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "structures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          active: boolean
          dealer_game_player_id: string | null
          game_id: string
          id: string
          number: number
          seat_count: number
        }
        Insert: {
          active?: boolean
          dealer_game_player_id?: string | null
          game_id: string
          id?: string
          number: number
          seat_count?: number
        }
        Update: {
          active?: boolean
          dealer_game_player_id?: string | null
          game_id?: string
          id?: string
          number?: number
          seat_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tables_dealer_fkey"
            columns: ["dealer_game_player_id", "game_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id", "game_id"]
          },
          {
            foreignKeyName: "tables_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_group: { Args: { p_name: string }; Returns: string }
      find_profile_by_public_id: {
        Args: { p_public_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          public_id: string
        }[]
      }
      get_panel: { Args: { p_code: string }; Returns: Json }
      join_group: { Args: { p_invite_code: string }; Returns: string }
      my_birth_date: { Args: never; Returns: string }
      eliminate_player: { Args: { p_game_player_id: string }; Returns: number }
      player_busted: { Args: { p_game_player_id: string; p_rebuy: boolean }; Returns: Json }
      set_seating: { Args: { p_game_id: string; p_tables: Json }; Returns: undefined }
      start_tournament: {
        Args: {
          p_group_id: string
          p_kit_id: string
          p_levels: Json
          p_name: string
          p_player_ids: string[]
          p_settings: Json
        }
        Returns: string
      }
      undo_elimination: { Args: { p_game_player_id: string }; Returns: undefined }
      restore_player: { Args: { p_player_id: string }; Returns: undefined }
      save_cash_settlement: {
        Args: { p_game_id: string; p_transfers: Json }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
