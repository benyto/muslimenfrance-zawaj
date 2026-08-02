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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          ip_address: unknown
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          department: string | null
          id: string
          name: string
          postal_code: string | null
          region: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          name: string
          postal_code?: string | null
          region?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          region?: string | null
        }
        Relationships: []
      }
      communes_fr: {
        Row: {
          academie_code: string | null
          academie_nom: string | null
          altitude_maximale: number | null
          altitude_minimale: number | null
          altitude_moyenne: number | null
          canton_code: string | null
          canton_nom: string | null
          code_insee: string
          code_insee_centre_zone_emploi: string | null
          code_postal: string | null
          code_unite_urbaine: string | null
          codes_postaux: string | null
          csv_index: number | null
          densite: number | null
          dep_code: string | null
          dep_nom: string | null
          epci_code: string | null
          epci_nom: string | null
          gentile: string | null
          grille_densite: string | null
          grille_densite_texte: string | null
          latitude_centre: number | null
          latitude_mairie: number | null
          longitude_centre: number | null
          longitude_mairie: number | null
          niveau_equipements_services: number | null
          niveau_equipements_services_texte: string | null
          nom_a: string | null
          nom_de: string | null
          nom_sans_accent: string | null
          nom_sans_pronom: string | null
          nom_standard: string | null
          nom_standard_majuscule: string | null
          nom_unite_urbaine: string | null
          population: number | null
          reg_code: string | null
          reg_nom: string | null
          statut_commune_unite_urbaine: string | null
          superficie_hectare: number | null
          superficie_km2: number | null
          taille_unite_urbaine: number | null
          type_commune_unite_urbaine: string | null
          typecom: string | null
          typecom_texte: string | null
          url_villedereve: string | null
          url_wikipedia: string | null
          zone_emploi: string | null
        }
        Insert: {
          academie_code?: string | null
          academie_nom?: string | null
          altitude_maximale?: number | null
          altitude_minimale?: number | null
          altitude_moyenne?: number | null
          canton_code?: string | null
          canton_nom?: string | null
          code_insee: string
          code_insee_centre_zone_emploi?: string | null
          code_postal?: string | null
          code_unite_urbaine?: string | null
          codes_postaux?: string | null
          csv_index?: number | null
          densite?: number | null
          dep_code?: string | null
          dep_nom?: string | null
          epci_code?: string | null
          epci_nom?: string | null
          gentile?: string | null
          grille_densite?: string | null
          grille_densite_texte?: string | null
          latitude_centre?: number | null
          latitude_mairie?: number | null
          longitude_centre?: number | null
          longitude_mairie?: number | null
          niveau_equipements_services?: number | null
          niveau_equipements_services_texte?: string | null
          nom_a?: string | null
          nom_de?: string | null
          nom_sans_accent?: string | null
          nom_sans_pronom?: string | null
          nom_standard?: string | null
          nom_standard_majuscule?: string | null
          nom_unite_urbaine?: string | null
          population?: number | null
          reg_code?: string | null
          reg_nom?: string | null
          statut_commune_unite_urbaine?: string | null
          superficie_hectare?: number | null
          superficie_km2?: number | null
          taille_unite_urbaine?: number | null
          type_commune_unite_urbaine?: string | null
          typecom?: string | null
          typecom_texte?: string | null
          url_villedereve?: string | null
          url_wikipedia?: string | null
          zone_emploi?: string | null
        }
        Update: {
          academie_code?: string | null
          academie_nom?: string | null
          altitude_maximale?: number | null
          altitude_minimale?: number | null
          altitude_moyenne?: number | null
          canton_code?: string | null
          canton_nom?: string | null
          code_insee?: string
          code_insee_centre_zone_emploi?: string | null
          code_postal?: string | null
          code_unite_urbaine?: string | null
          codes_postaux?: string | null
          csv_index?: number | null
          densite?: number | null
          dep_code?: string | null
          dep_nom?: string | null
          epci_code?: string | null
          epci_nom?: string | null
          gentile?: string | null
          grille_densite?: string | null
          grille_densite_texte?: string | null
          latitude_centre?: number | null
          latitude_mairie?: number | null
          longitude_centre?: number | null
          longitude_mairie?: number | null
          niveau_equipements_services?: number | null
          niveau_equipements_services_texte?: string | null
          nom_a?: string | null
          nom_de?: string | null
          nom_sans_accent?: string | null
          nom_sans_pronom?: string | null
          nom_standard?: string | null
          nom_standard_majuscule?: string | null
          nom_unite_urbaine?: string | null
          population?: number | null
          reg_code?: string | null
          reg_nom?: string | null
          statut_commune_unite_urbaine?: string | null
          superficie_hectare?: number | null
          superficie_km2?: number | null
          taille_unite_urbaine?: number | null
          type_commune_unite_urbaine?: string | null
          typecom?: string | null
          typecom_texte?: string | null
          url_villedereve?: string | null
          url_wikipedia?: string | null
          zone_emploi?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          last_message_content: string | null
          last_message_sender_profile_id: string | null
          last_notification_email_sent_at: string | null
          profile1_id: string
          profile2_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_content?: string | null
          last_message_sender_profile_id?: string | null
          last_notification_email_sent_at?: string | null
          profile1_id: string
          profile2_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_content?: string | null
          last_message_sender_profile_id?: string | null
          last_notification_email_sent_at?: string | null
          profile1_id?: string
          profile2_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_last_message_sender_profile_id_fkey"
            columns: ["last_message_sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_profile1_id_fkey"
            columns: ["profile1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_profile2_id_fkey"
            columns: ["profile2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_requests: {
        Row: {
          completed_at: string | null
          id: string
          request_type: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          request_type: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          request_type?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          recipient_profile_id: string
          sender_profile_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_profile_id: string
          sender_profile_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_profile_id?: string
          sender_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_photos: {
        Row: {
          created_at: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_status: string
          position: number
          profile_id: string
          uploadthing_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: string
          position?: number
          profile_id: string
          uploadthing_key: string
        }
        Update: {
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_status?: string
          position?: number
          profile_id?: string
          uploadthing_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_photos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birthdate: string
          body_type: string | null
          city_id: string | null
          created_at: string
          deleted_at: string | null
          drinker: string | null
          education_level: string | null
          employment_status: string | null
          ethnicity: string | null
          eye_color: string | null
          gender: string
          hair_color: string | null
          has_children: boolean | null
          height: number | null
          id: string
          income_range: string | null
          interests: string[]
          languages_spoken: string[]
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          moderation_status: string
          nickname: string
          occupation: string | null
          relationship_goal: string | null
          religion: string | null
          religiosity_level: string | null
          smoker: string | null
          special_category_consent: boolean
          special_category_consent_at: string | null
          updated_at: string
          user_id: string
          wants_children: string | null
          weight: number | null
        }
        Insert: {
          birthdate: string
          body_type?: string | null
          city_id?: string | null
          created_at?: string
          deleted_at?: string | null
          drinker?: string | null
          education_level?: string | null
          employment_status?: string | null
          ethnicity?: string | null
          eye_color?: string | null
          gender: string
          hair_color?: string | null
          has_children?: boolean | null
          height?: number | null
          id?: string
          income_range?: string | null
          interests?: string[]
          languages_spoken?: string[]
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_status?: string
          nickname: string
          occupation?: string | null
          relationship_goal?: string | null
          religion?: string | null
          religiosity_level?: string | null
          smoker?: string | null
          special_category_consent?: boolean
          special_category_consent_at?: string | null
          updated_at?: string
          user_id: string
          wants_children?: string | null
          weight?: number | null
        }
        Update: {
          birthdate?: string
          body_type?: string | null
          city_id?: string | null
          created_at?: string
          deleted_at?: string | null
          drinker?: string | null
          education_level?: string | null
          employment_status?: string | null
          ethnicity?: string | null
          eye_color?: string | null
          gender?: string
          hair_color?: string | null
          has_children?: boolean | null
          height?: number | null
          id?: string
          income_range?: string | null
          interests?: string[]
          languages_spoken?: string[]
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_status?: string
          nickname?: string
          occupation?: string | null
          relationship_goal?: string | null
          religion?: string | null
          religiosity_level?: string | null
          smoker?: string | null
          special_category_consent?: boolean
          special_category_consent_at?: string | null
          updated_at?: string
          user_id?: string
          wants_children?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          content_id: string
          content_type: string
          created_at: string
          description: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          content_id: string
          content_type: string
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_products: {
        Row: {
          audience: string
          created_at: string
          currency: string
          enabled: boolean
          id: string
          interval: string
          name: string
          price_amount: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_period_days: number
          updated_at: string
        }
        Insert: {
          audience: string
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          interval?: string
          name: string
          price_amount?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_period_days?: number
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          interval?: string
          name?: string
          price_amount?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_period_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_profile_id: string
          blocker_profile_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_profile_id: string
          blocker_profile_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_profile_id?: string
          blocker_profile_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_profile_id_fkey"
            columns: ["blocked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_profile_id_fkey"
            columns: ["blocker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_product_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_product_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          subscription_product_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_subscription_product_id_fkey"
            columns: ["subscription_product_id"]
            isOneToOne: false
            referencedRelation: "subscription_products"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          id: string
          processed_at: string
          type: string
        }
        Insert: {
          id: string
          processed_at?: string
          type: string
        }
        Update: {
          id?: string
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_blocked_profiles: {
        Args: never
        Returns: {
          blocked_at: string
          blocked_profile_id: string
          nickname: string
        }[]
      }
      get_my_conversations: {
        Args: never
        Returns: {
          conversation_id: string
          last_message_at: string
          last_message_content: string
          last_message_sender_profile_id: string
          other_nickname: string
          other_photo_key: string
          other_profile_id: string
          unread_count: number
        }[]
      }
      get_my_roles: { Args: never; Returns: string[] }
      get_profile_detail: {
        Args: { p_profile_id: string }
        Returns: {
          age: number
          body_type: string
          city_id: string
          drinker: string
          education_level: string
          employment_status: string
          ethnicity: string
          eye_color: string
          gender: string
          hair_color: string
          has_children: boolean
          height: number
          id: string
          income_range: string
          interests: string[]
          languages_spoken: string[]
          nickname: string
          occupation: string
          photo_keys: string[]
          relationship_goal: string
          religion: string
          religiosity_level: string
          smoker: string
          wants_children: string
          weight: number
        }[]
      }
      has_active_dating_subscription: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_admin_or_moderator: { Args: { p_user_id: string }; Returns: boolean }
      is_profile_blocked: {
        Args: { p_profile_a: string; p_profile_b: string }
        Returns: boolean
      }
      search_profiles: {
        Args: {
          p_city_id?: string
          p_gender?: string
          p_limit?: number
          p_max_age?: number
          p_min_age?: number
          p_offset?: number
          p_relationship_goal?: string
        }
        Returns: {
          age: number
          city_id: string
          gender: string
          id: string
          nickname: string
          primary_photo_key: string
          relationship_goal: string
          religion: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
