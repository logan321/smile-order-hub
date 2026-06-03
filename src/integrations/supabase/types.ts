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
      budget_items: {
        Row: {
          budget_id: string
          id: string
          quantity: number
          service_id: string
          unit_price: number
        }
        Insert: {
          budget_id: string
          id?: string
          quantity?: number
          service_id: string
          unit_price?: number
        }
        Update: {
          budget_id?: string
          id?: string
          quantity?: number
          service_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          client_email: string
          client_name: string
          client_phone: string
          created_at: string
          id: string
          notes: string
          user_id: string
        }
        Insert: {
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          notes?: string
          user_id: string
        }
        Update: {
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          notes?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          name: string
          phone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          name: string
          options: string[] | null
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          name: string
          options?: string[] | null
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          name?: string
          options?: string[] | null
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      niches: {
        Row: {
          background_image_url: string
          cover_image_url: string
          created_at: string
          icon: string
          id: string
          name: string
          patch_label: string
          position: number
          user_id: string
        }
        Insert: {
          background_image_url?: string
          cover_image_url?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          patch_label?: string
          position?: number
          user_id: string
        }
        Update: {
          background_image_url?: string
          cover_image_url?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          patch_label?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      order_custom_values: {
        Row: {
          custom_field_id: string
          id: string
          order_id: string
          value: string
        }
        Insert: {
          custom_field_id: string
          id?: string
          order_id: string
          value?: string
        }
        Update: {
          custom_field_id?: string
          id?: string
          order_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_custom_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_custom_values_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          order_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          order_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          quantity: number
          service_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          quantity?: number
          service_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          order_id?: string
          quantity?: number
          service_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stages: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          client_id: string
          confection_price: number
          created_at: string
          date: string
          delivery_date: string | null
          id: string
          name: string
          order_type: string
          paid: boolean
          status: string
          tracking_id: string
          user_id: string
        }
        Insert: {
          client_id: string
          confection_price?: number
          created_at?: string
          date?: string
          delivery_date?: string | null
          id?: string
          name?: string
          order_type?: string
          paid?: boolean
          status?: string
          tracking_id: string
          user_id: string
        }
        Update: {
          client_id?: string
          confection_price?: number
          created_at?: string
          date?: string
          delivery_date?: string | null
          id?: string
          name?: string
          order_type?: string
          paid?: boolean
          status?: string
          tracking_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      patch_catalog: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          name: string
          niche_id: string | null
          target_zone_name: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          name: string
          niche_id?: string | null
          target_zone_name?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          niche_id?: string | null
          target_zone_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patch_catalog_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          price?: number
          user_id?: string
        }
        Relationships: []
      }
      shirt_designs: {
        Row: {
          back_preview_url: string | null
          client_name: string
          client_phone: string
          created_at: string
          design_data: Json
          front_preview_url: string | null
          id: string
          owner_user_id: string
          template_id: string
        }
        Insert: {
          back_preview_url?: string | null
          client_name: string
          client_phone?: string
          created_at?: string
          design_data?: Json
          front_preview_url?: string | null
          id?: string
          owner_user_id: string
          template_id: string
        }
        Update: {
          back_preview_url?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          design_data?: Json
          front_preview_url?: string | null
          id?: string
          owner_user_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shirt_designs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "shirt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      shirt_templates: {
        Row: {
          active: boolean
          back_image_url: string
          created_at: string
          front_image_url: string
          id: string
          name: string
          niche_id: string | null
          user_id: string
          uv_map_id: string | null
          uv_map_url: string | null
        }
        Insert: {
          active?: boolean
          back_image_url: string
          created_at?: string
          front_image_url: string
          id?: string
          name: string
          niche_id?: string | null
          user_id: string
          uv_map_id?: string | null
          uv_map_url?: string | null
        }
        Update: {
          active?: boolean
          back_image_url?: string
          created_at?: string
          front_image_url?: string
          id?: string
          name?: string
          niche_id?: string | null
          user_id?: string
          uv_map_id?: string | null
          uv_map_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shirt_templates_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shirt_templates_uv_map_id_fkey"
            columns: ["uv_map_id"]
            isOneToOne: false
            referencedRelation: "uv_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_catalog: {
        Row: {
          active: boolean
          back_image_url: string | null
          category: string
          created_at: string
          id: string
          image_url: string
          name: string
          niche_id: string | null
          user_id: string
          uv_map_id: string | null
          uv_map_url: string | null
        }
        Insert: {
          active?: boolean
          back_image_url?: string | null
          category?: string
          created_at?: string
          id?: string
          image_url: string
          name: string
          niche_id?: string | null
          user_id: string
          uv_map_id?: string | null
          uv_map_url?: string | null
        }
        Update: {
          active?: boolean
          back_image_url?: string | null
          category?: string
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          niche_id?: string | null
          user_id?: string
          uv_map_id?: string | null
          uv_map_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stamp_catalog_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_catalog_uv_map_id_fkey"
            columns: ["uv_map_id"]
            isOneToOne: false
            referencedRelation: "uv_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_colors: {
        Row: {
          back_image_url: string | null
          color_hex: string
          color_name: string
          created_at: string
          id: string
          image_url: string
          position: number
          stamp_id: string
          user_id: string
        }
        Insert: {
          back_image_url?: string | null
          color_hex?: string
          color_name: string
          created_at?: string
          id?: string
          image_url: string
          position?: number
          stamp_id: string
          user_id: string
        }
        Update: {
          back_image_url?: string | null
          color_hex?: string
          color_name?: string
          created_at?: string
          id?: string
          image_url?: string
          position?: number
          stamp_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamp_colors_stamp_id_fkey"
            columns: ["stamp_id"]
            isOneToOne: false
            referencedRelation: "stamp_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          blocked: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          editor_enabled: boolean
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          editor_enabled?: boolean
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          editor_enabled?: boolean
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      template_zones: {
        Row: {
          back_height_percent: number
          back_path_data: Json | null
          back_rotation: number
          back_width_percent: number
          back_x_percent: number
          back_y_percent: number
          created_at: string
          height_percent: number
          id: string
          name: string
          patch_only: boolean
          path_data: Json | null
          rotation: number
          shared: boolean
          side: string
          template_id: string | null
          user_id: string
          uv_map_id: string | null
          width_percent: number
          x_percent: number
          y_percent: number
        }
        Insert: {
          back_height_percent?: number
          back_path_data?: Json | null
          back_rotation?: number
          back_width_percent?: number
          back_x_percent?: number
          back_y_percent?: number
          created_at?: string
          height_percent?: number
          id?: string
          name: string
          patch_only?: boolean
          path_data?: Json | null
          rotation?: number
          shared?: boolean
          side?: string
          template_id?: string | null
          user_id: string
          uv_map_id?: string | null
          width_percent?: number
          x_percent?: number
          y_percent?: number
        }
        Update: {
          back_height_percent?: number
          back_path_data?: Json | null
          back_rotation?: number
          back_width_percent?: number
          back_x_percent?: number
          back_y_percent?: number
          created_at?: string
          height_percent?: number
          id?: string
          name?: string
          patch_only?: boolean
          path_data?: Json | null
          rotation?: number
          shared?: boolean
          side?: string
          template_id?: string | null
          user_id?: string
          uv_map_id?: string | null
          width_percent?: number
          x_percent?: number
          y_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_zones_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "shirt_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_zones_uv_map_id_fkey"
            columns: ["uv_map_id"]
            isOneToOne: false
            referencedRelation: "uv_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      text_styles: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          image_url: string
          name: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          image_url: string
          name: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      trial_fingerprints: {
        Row: {
          created_at: string
          email: string
          fingerprint: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          fingerprint: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          fingerprint?: string
          id?: string
          user_id?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_settings: {
        Row: {
          created_at: string
          id: string
          tracking_slug: string
          updated_at: string
          user_id: string
          whatsapp_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          tracking_slug?: string
          updated_at?: string
          user_id: string
          whatsapp_number?: string
        }
        Update: {
          created_at?: string
          id?: string
          tracking_slug?: string
          updated_at?: string
          user_id?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      uv_maps: {
        Row: {
          code: string
          created_at: string
          id: string
          image_url: string
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          image_url: string
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          image_url?: string
          name?: string | null
          updated_at?: string
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
