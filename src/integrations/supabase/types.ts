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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      boards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          owner_id: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["board_visibility"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["board_visibility"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["board_visibility"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          board_id: string
          content: string
          created_at: string
          id: number
          ip: string | null
          rdns: string | null
          user_id: string | null
        }
        Insert: {
          board_id: string
          content: string
          created_at?: string
          id?: number
          ip?: string | null
          rdns?: string | null
          user_id?: string | null
        }
        Update: {
          board_id?: string
          content?: string
          created_at?: string
          id?: number
          ip?: string | null
          rdns?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      strokes: {
        Row: {
          board_id: string
          color: string
          created_at: string
          id: number
          path_data: Json
          user_id: string | null
          width: number
        }
        Insert: {
          board_id: string
          color: string
          created_at?: string
          id?: number
          path_data: Json
          user_id?: string | null
          width?: number
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          id?: number
          path_data?: Json
          user_id?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "strokes_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_backgrounds: {
        Row: {
          board_id: string
          created_at: string
          file_path: string | null
          id: string
          source_type: Database["public"]["Enums"]["video_source_type"]
          start_at_seconds: number | null
          user_id: string | null
          youtube_video_id: string | null
        }
        Insert: {
          board_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          source_type: Database["public"]["Enums"]["video_source_type"]
          start_at_seconds?: number | null
          user_id?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          source_type?: Database["public"]["Enums"]["video_source_type"]
          start_at_seconds?: number | null
          user_id?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_backgrounds_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      video_tiles: {
        Row: {
          board_id: string
          created_at: string
          file_path: string | null
          height: number
          id: string
          source_type: Database["public"]["Enums"]["video_source_type"]
          start_at_seconds: number | null
          user_id: string | null
          width: number
          x: number
          y: number
          youtube_video_id: string | null
        }
        Insert: {
          board_id: string
          created_at?: string
          file_path?: string | null
          height?: number
          id?: string
          source_type: Database["public"]["Enums"]["video_source_type"]
          start_at_seconds?: number | null
          user_id?: string | null
          width?: number
          x?: number
          y?: number
          youtube_video_id?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string
          file_path?: string | null
          height?: number
          id?: string
          source_type?: Database["public"]["Enums"]["video_source_type"]
          start_at_seconds?: number | null
          user_id?: string | null
          width?: number
          x?: number
          y?: number
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_tiles_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "moderator" | "user"
      board_visibility: "public" | "private"
      video_source_type: "youtube" | "upload"
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
      app_role: ["admin", "moderator", "user"],
      board_visibility: ["public", "private"],
      video_source_type: ["youtube", "upload"],
    },
  },
} as const
