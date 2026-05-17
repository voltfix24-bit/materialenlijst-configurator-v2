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
      app_instellingen: {
        Row: {
          sleutel: string
          updated_at: string
          waarde: string | null
        }
        Insert: {
          sleutel: string
          updated_at?: string
          waarde?: string | null
        }
        Update: {
          sleutel?: string
          updated_at?: string
          waarde?: string | null
        }
        Relationships: []
      }
      artikelen: {
        Row: {
          aantal_in_verpakking: number | null
          actief: boolean
          alternatief_artikel_nummer: string | null
          artikel_nummer: string
          basis_eenheid: string | null
          categorie: string | null
          created_at: string
          eenheid: string
          id: string
          korte_omschrijving: string
          status: string | null
        }
        Insert: {
          aantal_in_verpakking?: number | null
          actief?: boolean
          alternatief_artikel_nummer?: string | null
          artikel_nummer: string
          basis_eenheid?: string | null
          categorie?: string | null
          created_at?: string
          eenheid?: string
          id?: string
          korte_omschrijving: string
          status?: string | null
        }
        Update: {
          aantal_in_verpakking?: number | null
          actief?: boolean
          alternatief_artikel_nummer?: string | null
          artikel_nummer?: string
          basis_eenheid?: string | null
          categorie?: string | null
          created_at?: string
          eenheid?: string
          id?: string
          korte_omschrijving?: string
          status?: string | null
        }
        Relationships: []
      }
      beheer_notificaties: {
        Row: {
          aantal_correcties: number
          actie: string
          afgehandeld_door: string | null
          afgehandeld_op: string | null
          artikel_nummer: string
          case_type: string
          correctie_ids: string[] | null
          created_at: string | null
          gemiddelde_wijziging: number | null
          id: string
          korte_omschrijving: string | null
          status: string
          sub_type: string
          type: string
          updated_at: string | null
        }
        Insert: {
          aantal_correcties?: number
          actie: string
          afgehandeld_door?: string | null
          afgehandeld_op?: string | null
          artikel_nummer: string
          case_type: string
          correctie_ids?: string[] | null
          created_at?: string | null
          gemiddelde_wijziging?: number | null
          id?: string
          korte_omschrijving?: string | null
          status?: string
          sub_type: string
          type: string
          updated_at?: string | null
        }
        Update: {
          aantal_correcties?: number
          actie?: string
          afgehandeld_door?: string | null
          afgehandeld_op?: string | null
          artikel_nummer?: string
          case_type?: string
          correctie_ids?: string[] | null
          created_at?: string | null
          gemiddelde_wijziging?: number | null
          id?: string
          korte_omschrijving?: string | null
          status?: string
          sub_type?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      case_ls_moffen: {
        Row: {
          aantal: number
          aantal_aftakken: number | null
          aftak_doorsnede: number | null
          bestaand_type: string
          case_id: string
          hoofdkabel_doorsnede: number | null
          hoofdkabel_materiaal: string | null
          id: string
          kabel_lengte_meters: number | null
          kan_zwaaien: boolean | null
          overzettingen: number
          positie: number
          ringklem_artikel_nummer: string | null
          ringklem_handmatig: boolean | null
          type: string
        }
        Insert: {
          aantal?: number
          aantal_aftakken?: number | null
          aftak_doorsnede?: number | null
          bestaand_type: string
          case_id: string
          hoofdkabel_doorsnede?: number | null
          hoofdkabel_materiaal?: string | null
          id?: string
          kabel_lengte_meters?: number | null
          kan_zwaaien?: boolean | null
          overzettingen?: number
          positie: number
          ringklem_artikel_nummer?: string | null
          ringklem_handmatig?: boolean | null
          type: string
        }
        Update: {
          aantal?: number
          aantal_aftakken?: number | null
          aftak_doorsnede?: number | null
          bestaand_type?: string
          case_id?: string
          hoofdkabel_doorsnede?: number | null
          hoofdkabel_materiaal?: string | null
          id?: string
          kabel_lengte_meters?: number | null
          kan_zwaaien?: boolean | null
          overzettingen?: number
          positie?: number
          ringklem_artikel_nummer?: string | null
          ringklem_handmatig?: boolean | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_ls_moffen_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_materialen: {
        Row: {
          artikel_id: string
          case_id: string
          gewenste_hoeveelheid: number
          herkomst_label: string | null
          id: string
          niet_bestellen: boolean
          notitie: string | null
        }
        Insert: {
          artikel_id: string
          case_id: string
          gewenste_hoeveelheid?: number
          herkomst_label?: string | null
          id?: string
          niet_bestellen?: boolean
          notitie?: string | null
        }
        Update: {
          artikel_id?: string
          case_id?: string
          gewenste_hoeveelheid?: number
          herkomst_label?: string | null
          id?: string
          niet_bestellen?: boolean
          notitie?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_materialen_artikel_id_fkey"
            columns: ["artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_materialen_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_ms_moffen: {
        Row: {
          bestaand_type: string | null
          case_id: string
          def_bestaand_type: string | null
          def_doorsnede: number | null
          def_is_eindmof: boolean | null
          def_mof_handmatig: boolean | null
          def_nieuw_doorsnede: number | null
          def_nieuw_type: string | null
          doorsnede: number | null
          fase: string | null
          id: string
          is_eindmof: boolean | null
          mof_definitief_type_id: string | null
          mof_handmatig: boolean
          mof_type_id: string | null
          nieuw_doorsnede: number | null
          nieuw_type: string | null
          positie: number
          zwaaien: boolean
        }
        Insert: {
          bestaand_type?: string | null
          case_id: string
          def_bestaand_type?: string | null
          def_doorsnede?: number | null
          def_is_eindmof?: boolean | null
          def_mof_handmatig?: boolean | null
          def_nieuw_doorsnede?: number | null
          def_nieuw_type?: string | null
          doorsnede?: number | null
          fase?: string | null
          id?: string
          is_eindmof?: boolean | null
          mof_definitief_type_id?: string | null
          mof_handmatig?: boolean
          mof_type_id?: string | null
          nieuw_doorsnede?: number | null
          nieuw_type?: string | null
          positie: number
          zwaaien?: boolean
        }
        Update: {
          bestaand_type?: string | null
          case_id?: string
          def_bestaand_type?: string | null
          def_doorsnede?: number | null
          def_is_eindmof?: boolean | null
          def_mof_handmatig?: boolean | null
          def_nieuw_doorsnede?: number | null
          def_nieuw_type?: string | null
          doorsnede?: number | null
          fase?: string | null
          id?: string
          is_eindmof?: boolean | null
          mof_definitief_type_id?: string | null
          mof_handmatig?: boolean
          mof_type_id?: string | null
          nieuw_doorsnede?: number | null
          nieuw_type?: string | null
          positie?: number
          zwaaien?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "case_ms_moffen_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_ms_moffen_mof_definitief_type_id_fkey"
            columns: ["mof_definitief_type_id"]
            isOneToOne: false
            referencedRelation: "ms_mof_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_ms_moffen_mof_type_id_fkey"
            columns: ["mof_type_id"]
            isOneToOne: false
            referencedRelation: "ms_mof_types"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_nummer: string | null
          case_type: string
          config_json: Json | null
          created_at: string
          id: string
          notities: string | null
          station_naam: string | null
          status: string
          sub_type: string | null
          updated_at: string
        }
        Insert: {
          case_nummer?: string | null
          case_type: string
          config_json?: Json | null
          created_at?: string
          id?: string
          notities?: string | null
          station_naam?: string | null
          status?: string
          sub_type?: string | null
          updated_at?: string
        }
        Update: {
          case_nummer?: string | null
          case_type?: string
          config_json?: Json | null
          created_at?: string
          id?: string
          notities?: string | null
          station_naam?: string | null
          status?: string
          sub_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ggi_artikelen: {
        Row: {
          actief: boolean
          artikel_id: string
          created_at: string
          hoeveelheid: number
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          actief?: boolean
          artikel_id: string
          created_at?: string
          hoeveelheid?: number
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          actief?: boolean
          artikel_id?: string
          created_at?: string
          hoeveelheid?: number
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ls_mof_materialen: {
        Row: {
          artikel_id: string
          hoeveelheid: number
          hoeveelheid_formule: string | null
          id: string
          mof_type_id: string
        }
        Insert: {
          artikel_id: string
          hoeveelheid?: number
          hoeveelheid_formule?: string | null
          id?: string
          mof_type_id: string
        }
        Update: {
          artikel_id?: string
          hoeveelheid?: number
          hoeveelheid_formule?: string | null
          id?: string
          mof_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ls_mof_materialen_artikel_id_fkey"
            columns: ["artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ls_mof_materialen_mof_type_id_fkey"
            columns: ["mof_type_id"]
            isOneToOne: false
            referencedRelation: "ls_mof_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ls_mof_types: {
        Row: {
          actief: boolean
          bestaand_type: string
          id: string
          omschrijving: string | null
          type: string
        }
        Insert: {
          actief?: boolean
          bestaand_type: string
          id?: string
          omschrijving?: string | null
          type: string
        }
        Update: {
          actief?: boolean
          bestaand_type?: string
          id?: string
          omschrijving?: string | null
          type?: string
        }
        Relationships: []
      }
      ms_mof_materialen: {
        Row: {
          artikel_id: string
          hoeveelheid: number
          hoeveelheid_formule: string | null
          id: string
          mof_type_id: string
        }
        Insert: {
          artikel_id: string
          hoeveelheid?: number
          hoeveelheid_formule?: string | null
          id?: string
          mof_type_id: string
        }
        Update: {
          artikel_id?: string
          hoeveelheid?: number
          hoeveelheid_formule?: string | null
          id?: string
          mof_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_mof_materialen_artikel_id_fkey"
            columns: ["artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ms_mof_materialen_mof_type_id_fkey"
            columns: ["mof_type_id"]
            isOneToOne: false
            referencedRelation: "ms_mof_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ms_mof_types: {
        Row: {
          actief: boolean
          artikel_id: string | null
          bestaand_doorsnede_max: number | null
          bestaand_doorsnede_min: number | null
          bestaand_type: string
          code: string
          id: string
          nieuwe_doorsnede_max: number | null
          nieuwe_doorsnede_min: number | null
          nieuwe_type: string | null
          omschrijving: string | null
        }
        Insert: {
          actief?: boolean
          artikel_id?: string | null
          bestaand_doorsnede_max?: number | null
          bestaand_doorsnede_min?: number | null
          bestaand_type: string
          code: string
          id?: string
          nieuwe_doorsnede_max?: number | null
          nieuwe_doorsnede_min?: number | null
          nieuwe_type?: string | null
          omschrijving?: string | null
        }
        Update: {
          actief?: boolean
          artikel_id?: string | null
          bestaand_doorsnede_max?: number | null
          bestaand_doorsnede_min?: number | null
          bestaand_type?: string
          code?: string
          id?: string
          nieuwe_doorsnede_max?: number | null
          nieuwe_doorsnede_min?: number | null
          nieuwe_type?: string | null
          omschrijving?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_mof_types_artikel_id_fkey"
            columns: ["artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
        ]
      }
      rmu_configuraties: {
        Row: {
          aantal_c: number
          aantal_f: number
          aantal_v: number
          aantal_velden: number
          actief: boolean
          bodemplaat_artikel_id: string | null
          code: string
          frame_artikel_id: string | null
          id: string
          is_inet: boolean
          merk: string
          rmu_artikel_id: string | null
        }
        Insert: {
          aantal_c?: number
          aantal_f?: number
          aantal_v?: number
          aantal_velden?: number
          actief?: boolean
          bodemplaat_artikel_id?: string | null
          code: string
          frame_artikel_id?: string | null
          id?: string
          is_inet?: boolean
          merk: string
          rmu_artikel_id?: string | null
        }
        Update: {
          aantal_c?: number
          aantal_f?: number
          aantal_v?: number
          aantal_velden?: number
          actief?: boolean
          bodemplaat_artikel_id?: string | null
          code?: string
          frame_artikel_id?: string | null
          id?: string
          is_inet?: boolean
          merk?: string
          rmu_artikel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rmu_configuraties_bodemplaat_artikel_id_fkey"
            columns: ["bodemplaat_artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rmu_configuraties_frame_artikel_id_fkey"
            columns: ["frame_artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rmu_configuraties_rmu_artikel_id_fkey"
            columns: ["rmu_artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
        ]
      }
      rmu_veld_artikelen: {
        Row: {
          artikel_id: string
          hoeveelheid: number
          hoeveelheid_formule: string | null
          id: string
          is_inet: boolean
          merk: string
          veld_type: string
        }
        Insert: {
          artikel_id: string
          hoeveelheid?: number
          hoeveelheid_formule?: string | null
          id?: string
          is_inet?: boolean
          merk: string
          veld_type: string
        }
        Update: {
          artikel_id?: string
          hoeveelheid?: number
          hoeveelheid_formule?: string | null
          id?: string
          is_inet?: boolean
          merk?: string
          veld_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rmu_veld_artikelen_artikel_id_fkey"
            columns: ["artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
        ]
      }
      rmu_zekeringen: {
        Row: {
          artikel_id: string
          hoeveelheid: number
          id: string
          merk: string
          trafo_kva: number
        }
        Insert: {
          artikel_id: string
          hoeveelheid?: number
          id?: string
          merk: string
          trafo_kva: number
        }
        Update: {
          artikel_id?: string
          hoeveelheid?: number
          id?: string
          merk?: string
          trafo_kva?: number
        }
        Relationships: [
          {
            foreignKeyName: "rmu_zekeringen_artikel_id_fkey"
            columns: ["artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
        ]
      }
      standaard_materialen_templates: {
        Row: {
          artikel_id: string
          case_type: string
          id: string
          standaard_hoeveelheid: number
        }
        Insert: {
          artikel_id: string
          case_type: string
          id?: string
          standaard_hoeveelheid?: number
        }
        Update: {
          artikel_id?: string
          case_type?: string
          id?: string
          standaard_hoeveelheid?: number
        }
        Relationships: [
          {
            foreignKeyName: "standaard_materialen_templates_artikel_id_fkey"
            columns: ["artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
        ]
      }
      station_vaste_artikelen: {
        Row: {
          actief: boolean
          artikel_id: string
          groep: string | null
          hoeveelheid: number
          id: string
          van_toepassing_bij: string[]
        }
        Insert: {
          actief?: boolean
          artikel_id: string
          groep?: string | null
          hoeveelheid?: number
          id?: string
          van_toepassing_bij?: string[]
        }
        Update: {
          actief?: boolean
          artikel_id?: string
          groep?: string | null
          hoeveelheid?: number
          id?: string
          van_toepassing_bij?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "station_vaste_artikelen_artikel_id_fkey"
            columns: ["artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
        ]
      }
      trafo_regels: {
        Row: {
          actief: boolean
          artikel_id: string
          conditie_actie: string | null
          conditie_kabel_lengte: string | null
          conditie_kva: string | null
          created_at: string
          herkomst_label: string
          hoeveelheid: number
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          actief?: boolean
          artikel_id: string
          conditie_actie?: string | null
          conditie_kabel_lengte?: string | null
          conditie_kva?: string | null
          created_at?: string
          herkomst_label: string
          hoeveelheid?: number
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          actief?: boolean
          artikel_id?: string
          conditie_actie?: string | null
          conditie_kabel_lengte?: string | null
          conditie_kva?: string | null
          created_at?: string
          herkomst_label?: string
          hoeveelheid?: number
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      trafo_vult_kabel: {
        Row: {
          aantal_kabels: number
          aantal_perskabelschoenen: number
          id: string
          kabel_doorsnede: number
          perskabelschoen_artikel_id: string | null
          trafo_kva: number
        }
        Insert: {
          aantal_kabels?: number
          aantal_perskabelschoenen?: number
          id?: string
          kabel_doorsnede: number
          perskabelschoen_artikel_id?: string | null
          trafo_kva: number
        }
        Update: {
          aantal_kabels?: number
          aantal_perskabelschoenen?: number
          id?: string
          kabel_doorsnede?: number
          perskabelschoen_artikel_id?: string | null
          trafo_kva?: number
        }
        Relationships: [
          {
            foreignKeyName: "trafo_vult_kabel_perskabelschoen_artikel_id_fkey"
            columns: ["perskabelschoen_artikel_id"]
            isOneToOne: false
            referencedRelation: "artikelen"
            referencedColumns: ["id"]
          },
        ]
      }
      winkelwagen_correcties: {
        Row: {
          actie: string
          artikel_nummer: string
          case_id: string | null
          case_type: string
          created_at: string | null
          engineer_id: string | null
          id: string
          korte_omschrijving: string | null
          nieuwe_hoeveelheid: number | null
          oude_hoeveelheid: number | null
          reden: string | null
          scope: string
          sub_type: string
        }
        Insert: {
          actie: string
          artikel_nummer: string
          case_id?: string | null
          case_type: string
          created_at?: string | null
          engineer_id?: string | null
          id?: string
          korte_omschrijving?: string | null
          nieuwe_hoeveelheid?: number | null
          oude_hoeveelheid?: number | null
          reden?: string | null
          scope: string
          sub_type: string
        }
        Update: {
          actie?: string
          artikel_nummer?: string
          case_id?: string | null
          case_type?: string
          created_at?: string | null
          engineer_id?: string | null
          id?: string
          korte_omschrijving?: string | null
          nieuwe_hoeveelheid?: number | null
          oude_hoeveelheid?: number | null
          reden?: string | null
          scope?: string
          sub_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "winkelwagen_correcties_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
