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
      admin_plans: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          food_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          acucares_por_100: number
          atualizado_por: string | null
          calorias_por_100: number
          carbo_por_100: number
          codigo_barras: string | null
          colesterol_por_100: number
          created_at: string
          criado_por: string | null
          fibras_por_100: number
          gordura_por_100: number
          gordura_saturada_por_100: number
          gordura_trans_por_100: number
          id: string
          nome: string
          potassio_por_100: number
          proteina_por_100: number
          sodio_por_100: number
          unidade: string
          updated_at: string
        }
        Insert: {
          acucares_por_100?: number
          atualizado_por?: string | null
          calorias_por_100?: number
          carbo_por_100?: number
          codigo_barras?: string | null
          colesterol_por_100?: number
          created_at?: string
          criado_por?: string | null
          fibras_por_100?: number
          gordura_por_100?: number
          gordura_saturada_por_100?: number
          gordura_trans_por_100?: number
          id?: string
          nome: string
          potassio_por_100?: number
          proteina_por_100?: number
          sodio_por_100?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          acucares_por_100?: number
          atualizado_por?: string | null
          calorias_por_100?: number
          carbo_por_100?: number
          codigo_barras?: string | null
          colesterol_por_100?: number
          created_at?: string
          criado_por?: string | null
          fibras_por_100?: number
          gordura_por_100?: number
          gordura_saturada_por_100?: number
          gordura_trans_por_100?: number
          id?: string
          nome?: string
          potassio_por_100?: number
          proteina_por_100?: number
          sodio_por_100?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          calorias_calculadas: number
          carbo: number
          created_at: string
          food_id: string
          gordura: number
          id: string
          meal_id: string
          proteina: number
          quantidade: number
        }
        Insert: {
          calorias_calculadas?: number
          carbo?: number
          created_at?: string
          food_id: string
          gordura?: number
          id?: string
          meal_id: string
          proteina?: number
          quantidade: number
        }
        Update: {
          calorias_calculadas?: number
          carbo?: number
          created_at?: string
          food_id?: string
          gordura?: number
          id?: string
          meal_id?: string
          proteina?: number
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_reminders: {
        Row: {
          ativo: boolean
          created_at: string
          dias_semana: number[]
          horario: string
          id: string
          tipo_refeicao: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          horario: string
          id?: string
          tipo_refeicao: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          horario?: string
          id?: string
          tipo_refeicao?: string
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          created_at: string
          data: string
          id: string
          nome_personalizado: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          nome_personalizado?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          nome_personalizado?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_locked: boolean
          ajuste_calorico: number
          altura: number | null
          blocked: boolean
          created_at: string
          data_nascimento: string | null
          dc_abdominal: number | null
          dc_coxa: number | null
          dc_peitoral: number | null
          dc_suprailiaca: number | null
          dc_tricipital: number | null
          email: string
          foto_url: string | null
          id: string
          macro_gordura_percentual: number
          macro_proteina_multiplicador: number
          massa_gorda: number | null
          massa_magra: number | null
          meta_acucares: number
          meta_colesterol: number
          meta_fibras: number
          meta_gordura_saturada: number
          meta_potassio: number
          meta_sodio: number
          nivel_atividade: number
          nome: string
          objetivo: string
          percentual_gordura: number | null
          peso: number | null
          plano_expiracao: string | null
          plano_id: string | null
          plano_inicio: string | null
          sexo: string | null
          tema: string
          tmb_metodo: string
          updated_at: string
          user_code: number | null
          user_id: string
        }
        Insert: {
          admin_locked?: boolean
          ajuste_calorico?: number
          altura?: number | null
          blocked?: boolean
          created_at?: string
          data_nascimento?: string | null
          dc_abdominal?: number | null
          dc_coxa?: number | null
          dc_peitoral?: number | null
          dc_suprailiaca?: number | null
          dc_tricipital?: number | null
          email?: string
          foto_url?: string | null
          id?: string
          macro_gordura_percentual?: number
          macro_proteina_multiplicador?: number
          massa_gorda?: number | null
          massa_magra?: number | null
          meta_acucares?: number
          meta_colesterol?: number
          meta_fibras?: number
          meta_gordura_saturada?: number
          meta_potassio?: number
          meta_sodio?: number
          nivel_atividade?: number
          nome?: string
          objetivo?: string
          percentual_gordura?: number | null
          peso?: number | null
          plano_expiracao?: string | null
          plano_id?: string | null
          plano_inicio?: string | null
          sexo?: string | null
          tema?: string
          tmb_metodo?: string
          updated_at?: string
          user_code?: number | null
          user_id: string
        }
        Update: {
          admin_locked?: boolean
          ajuste_calorico?: number
          altura?: number | null
          blocked?: boolean
          created_at?: string
          data_nascimento?: string | null
          dc_abdominal?: number | null
          dc_coxa?: number | null
          dc_peitoral?: number | null
          dc_suprailiaca?: number | null
          dc_tricipital?: number | null
          email?: string
          foto_url?: string | null
          id?: string
          macro_gordura_percentual?: number
          macro_proteina_multiplicador?: number
          massa_gorda?: number | null
          massa_magra?: number | null
          meta_acucares?: number
          meta_colesterol?: number
          meta_fibras?: number
          meta_gordura_saturada?: number
          meta_potassio?: number
          meta_sodio?: number
          nivel_atividade?: number
          nome?: string
          objetivo?: string
          percentual_gordura?: number | null
          peso?: number | null
          plano_expiracao?: string | null
          plano_id?: string | null
          plano_inicio?: string | null
          sexo?: string | null
          tema?: string
          tmb_metodo?: string
          updated_at?: string
          user_code?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "admin_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_foods: {
        Row: {
          food_id: string
          id: string
          quantidade: number | null
          usado_em: string
          user_id: string
        }
        Insert: {
          food_id: string
          id?: string
          quantidade?: number | null
          usado_em?: string
          user_id: string
        }
        Update: {
          food_id?: string
          id?: string
          quantidade?: number | null
          usado_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recent_foods_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          created_at: string
          food_id: string
          id: string
          quantidade: number
          recipe_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          quantidade: number
          recipe_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          quantidade?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      water_intake: {
        Row: {
          data: string
          id: string
          quantidade_ml: number
          registrado_em: string
          user_id: string
        }
        Insert: {
          data: string
          id?: string
          quantidade_ml?: number
          registrado_em?: string
          user_id: string
        }
        Update: {
          data?: string
          id?: string
          quantidade_ml?: number
          registrado_em?: string
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
      app_role: "admin" | "moderator" | "user"
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
    },
  },
} as const
