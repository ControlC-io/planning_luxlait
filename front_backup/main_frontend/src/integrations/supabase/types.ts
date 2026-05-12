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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      accumalux_employee_machine_skills: {
        Row: {
          employee_id: string
          id: string
          machine_id: string
        }
        Insert: {
          employee_id: string
          id?: string
          machine_id: string
        }
        Update: {
          employee_id?: string
          id?: string
          machine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accumalux_employee_machine_skills_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accumalux_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accumalux_employee_machine_skills_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "accumalux_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      accumalux_employees: {
        Row: {
          active: boolean
          created_at: string
          first_name: string
          id: string
          is_backup: boolean
          last_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          first_name: string
          id?: string
          is_backup?: boolean
          last_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          first_name?: string
          id?: string
          is_backup?: boolean
          last_name?: string
        }
        Relationships: []
      }
      accumalux_machines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          machine_group: string | null
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          machine_group?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          machine_group?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      accumalux_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      accumalux_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      accumalux_time_slots: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      accumalux_weekly_assignments: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          machine_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          machine_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          machine_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "accumalux_weekly_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accumalux_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accumalux_weekly_assignments_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "accumalux_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      accumalux_weekly_employee_statuses: {
        Row: {
          created_at: string
          day_date: string
          employee_id: string
          id: string
          status_id: string
        }
        Insert: {
          created_at?: string
          day_date: string
          employee_id: string
          id?: string
          status_id: string
        }
        Update: {
          created_at?: string
          day_date?: string
          employee_id?: string
          id?: string
          status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accumalux_weekly_employee_statuses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accumalux_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accumalux_weekly_employee_statuses_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "accumalux_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      ferrero_doc_types: {
        Row: {
          id: string
          label: string | null
          upload_message: string | null
        }
        Insert: {
          id: string
          label?: string | null
          upload_message?: string | null
        }
        Update: {
          id?: string
          label?: string | null
          upload_message?: string | null
        }
        Relationships: []
      }
      ferrero_documents: {
        Row: {
          barcode_7: string | null
          data_extract: boolean | null
          data_extract_doc_type: string | null
          data_extract_employee_name: string | null
          data_extract_employee_number: string | null
          document_id: string
          document_name_original: string
          is_renamed_in_onedrive: boolean | null
          new_name: string | null
          peopledoc_file_id: string | null
          upload_error: string | null
          uploaded_in_peopledoc: boolean | null
        }
        Insert: {
          barcode_7?: string | null
          data_extract?: boolean | null
          data_extract_doc_type?: string | null
          data_extract_employee_name?: string | null
          data_extract_employee_number?: string | null
          document_id: string
          document_name_original: string
          is_renamed_in_onedrive?: boolean | null
          new_name?: string | null
          peopledoc_file_id?: string | null
          upload_error?: string | null
          uploaded_in_peopledoc?: boolean | null
        }
        Update: {
          barcode_7?: string | null
          data_extract?: boolean | null
          data_extract_doc_type?: string | null
          data_extract_employee_name?: string | null
          data_extract_employee_number?: string | null
          document_id?: string
          document_name_original?: string
          is_renamed_in_onedrive?: boolean | null
          new_name?: string | null
          peopledoc_file_id?: string | null
          upload_error?: string | null
          uploaded_in_peopledoc?: boolean | null
        }
        Relationships: []
      }
      ferrero_employee: {
        Row: {
          barcode_7: string | null
          first_name: string | null
          last_name: string | null
          peopledoc_employee_id: string | null
          pers_no: string
          scope: string | null
          sub_group: string | null
        }
        Insert: {
          barcode_7?: string | null
          first_name?: string | null
          last_name?: string | null
          peopledoc_employee_id?: string | null
          pers_no: string
          scope?: string | null
          sub_group?: string | null
        }
        Update: {
          barcode_7?: string | null
          first_name?: string | null
          last_name?: string | null
          peopledoc_employee_id?: string | null
          pers_no?: string
          scope?: string | null
          sub_group?: string | null
        }
        Relationships: []
      }
      FNR_form_condition: {
        Row: {
          created_at: string
          expression: string | null
          id: number
          parent_element_id: number | null
          rule_type: string | null
          target_element_id: number | null
        }
        Insert: {
          created_at?: string
          expression?: string | null
          id?: number
          parent_element_id?: number | null
          rule_type?: string | null
          target_element_id?: number | null
        }
        Update: {
          created_at?: string
          expression?: string | null
          id?: number
          parent_element_id?: number | null
          rule_type?: string | null
          target_element_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "FNR_form_condition_parent_element_id_fkey"
            columns: ["parent_element_id"]
            isOneToOne: false
            referencedRelation: "FNR_form_element"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FNR_form_condition_target_element_id_fkey"
            columns: ["target_element_id"]
            isOneToOne: false
            referencedRelation: "FNR_form_element"
            referencedColumns: ["id"]
          },
        ]
      }
      FNR_form_element: {
        Row: {
          created_at: string
          id: number
          name: string | null
          page_id: number | null
          parent_element_id: number | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          page_id?: number | null
          parent_element_id?: number | null
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          page_id?: number | null
          parent_element_id?: number | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "FNR_form_element_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "FNR_form_page"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FNR_form_element_parent_element_id_fkey"
            columns: ["parent_element_id"]
            isOneToOne: false
            referencedRelation: "FNR_form_element"
            referencedColumns: ["id"]
          },
        ]
      }
      FNR_form_page: {
        Row: {
          created_at: string
          form_id: number | null
          id: number
          name: string
          title: string | null
        }
        Insert: {
          created_at?: string
          form_id?: number | null
          id?: number
          name: string
          title?: string | null
        }
        Update: {
          created_at?: string
          form_id?: number | null
          id?: number
          name?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "FNR_form_page_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "FNR_form_template"
            referencedColumns: ["id"]
          },
        ]
      }
      FNR_form_template: {
        Row: {
          created_at: string
          id: number
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          title?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          allergens: string | null
          category: string | null
          id: string
          ingredients: string | null
          minimal_description: string | null
          name: string | null
          nutritional_values_text: string | null
          selling_price: number | null
          sub_category: string | null
          weight: number | null
        }
        Insert: {
          allergens?: string | null
          category?: string | null
          id: string
          ingredients?: string | null
          minimal_description?: string | null
          name?: string | null
          nutritional_values_text?: string | null
          selling_price?: number | null
          sub_category?: string | null
          weight?: number | null
        }
        Update: {
          allergens?: string | null
          category?: string | null
          id?: string
          ingredients?: string | null
          minimal_description?: string | null
          name?: string | null
          nutritional_values_text?: string | null
          selling_price?: number | null
          sub_category?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      linkedin_accounts: {
        Row: {
          account_category: string | null
          account_category_reason: string | null
          chat_id: string | null
          controlc_decision: Database["public"]["Enums"]["controlc_decision"]
          followers_count: number | null
          guess_company: string | null
          guess_company_reason: string | null
          guess_language: string | null
          headline: string | null
          id: string
          invitation_accepted: boolean | null
          invitation_message: string | null
          invitation_sent: boolean | null
          invitation_sent_at: string | null
          keywords_match: string | null
          location: string | null
          member_urn: string | null
          name: string | null
          network_distance: string | null
          original_search: string | null
          profile_connections_count: number | null
          profile_first_name: string | null
          profile_follower_count: number | null
          profile_last_name: string | null
          profile_location: string | null
          profile_scrapped: boolean | null
          profile_web_site: string | null
          public_identifier: string | null
          related_account_id: string | null
          related_account_name: string | null
          shared_connections_count: number | null
          verified: boolean | null
        }
        Insert: {
          account_category?: string | null
          account_category_reason?: string | null
          chat_id?: string | null
          controlc_decision?: Database["public"]["Enums"]["controlc_decision"]
          followers_count?: number | null
          guess_company?: string | null
          guess_company_reason?: string | null
          guess_language?: string | null
          headline?: string | null
          id: string
          invitation_accepted?: boolean | null
          invitation_message?: string | null
          invitation_sent?: boolean | null
          invitation_sent_at?: string | null
          keywords_match?: string | null
          location?: string | null
          member_urn?: string | null
          name?: string | null
          network_distance?: string | null
          original_search?: string | null
          profile_connections_count?: number | null
          profile_first_name?: string | null
          profile_follower_count?: number | null
          profile_last_name?: string | null
          profile_location?: string | null
          profile_scrapped?: boolean | null
          profile_web_site?: string | null
          public_identifier?: string | null
          related_account_id?: string | null
          related_account_name?: string | null
          shared_connections_count?: number | null
          verified?: boolean | null
        }
        Update: {
          account_category?: string | null
          account_category_reason?: string | null
          chat_id?: string | null
          controlc_decision?: Database["public"]["Enums"]["controlc_decision"]
          followers_count?: number | null
          guess_company?: string | null
          guess_company_reason?: string | null
          guess_language?: string | null
          headline?: string | null
          id?: string
          invitation_accepted?: boolean | null
          invitation_message?: string | null
          invitation_sent?: boolean | null
          invitation_sent_at?: string | null
          keywords_match?: string | null
          location?: string | null
          member_urn?: string | null
          name?: string | null
          network_distance?: string | null
          original_search?: string | null
          profile_connections_count?: number | null
          profile_first_name?: string | null
          profile_follower_count?: number | null
          profile_last_name?: string | null
          profile_location?: string | null
          profile_scrapped?: boolean | null
          profile_web_site?: string | null
          public_identifier?: string | null
          related_account_id?: string | null
          related_account_name?: string | null
          shared_connections_count?: number | null
          verified?: boolean | null
        }
        Relationships: []
      }
      linkedin_accounts_chloé: {
        Row: {
          account_category: string | null
          account_category_reason: string | null
          chat_id: string | null
          controlc_decision: Database["public"]["Enums"]["controlc_decision"]
          followers_count: number | null
          guess_company: string | null
          guess_company_reason: string | null
          guess_language: string | null
          headline: string | null
          id: string
          invitation_accepted: boolean | null
          invitation_message: string | null
          invitation_sent: boolean | null
          invitation_sent_at: string | null
          keywords_match: string | null
          location: string | null
          member_urn: string | null
          name: string | null
          network_distance: string | null
          original_search: string | null
          profile_connections_count: number | null
          profile_first_name: string | null
          profile_follower_count: number | null
          profile_last_name: string | null
          profile_location: string | null
          profile_scrapped: boolean | null
          profile_web_site: string | null
          public_identifier: string | null
          related_account_id: string | null
          related_account_name: string | null
          shared_connections_count: number | null
          verified: boolean | null
        }
        Insert: {
          account_category?: string | null
          account_category_reason?: string | null
          chat_id?: string | null
          controlc_decision?: Database["public"]["Enums"]["controlc_decision"]
          followers_count?: number | null
          guess_company?: string | null
          guess_company_reason?: string | null
          guess_language?: string | null
          headline?: string | null
          id: string
          invitation_accepted?: boolean | null
          invitation_message?: string | null
          invitation_sent?: boolean | null
          invitation_sent_at?: string | null
          keywords_match?: string | null
          location?: string | null
          member_urn?: string | null
          name?: string | null
          network_distance?: string | null
          original_search?: string | null
          profile_connections_count?: number | null
          profile_first_name?: string | null
          profile_follower_count?: number | null
          profile_last_name?: string | null
          profile_location?: string | null
          profile_scrapped?: boolean | null
          profile_web_site?: string | null
          public_identifier?: string | null
          related_account_id?: string | null
          related_account_name?: string | null
          shared_connections_count?: number | null
          verified?: boolean | null
        }
        Update: {
          account_category?: string | null
          account_category_reason?: string | null
          chat_id?: string | null
          controlc_decision?: Database["public"]["Enums"]["controlc_decision"]
          followers_count?: number | null
          guess_company?: string | null
          guess_company_reason?: string | null
          guess_language?: string | null
          headline?: string | null
          id?: string
          invitation_accepted?: boolean | null
          invitation_message?: string | null
          invitation_sent?: boolean | null
          invitation_sent_at?: string | null
          keywords_match?: string | null
          location?: string | null
          member_urn?: string | null
          name?: string | null
          network_distance?: string | null
          original_search?: string | null
          profile_connections_count?: number | null
          profile_first_name?: string | null
          profile_follower_count?: number | null
          profile_last_name?: string | null
          profile_location?: string | null
          profile_scrapped?: boolean | null
          profile_web_site?: string | null
          public_identifier?: string | null
          related_account_id?: string | null
          related_account_name?: string | null
          shared_connections_count?: number | null
          verified?: boolean | null
        }
        Relationships: []
      }
      lovable_task_manager: {
        Row: {
          dead_line: string | null
          hex_color: string | null
          is_archived: boolean
          task_description: string | null
          task_id: number
          task_name: string
          task_status: Database["public"]["Enums"]["task_status"]
        }
        Insert: {
          dead_line?: string | null
          hex_color?: string | null
          is_archived?: boolean
          task_description?: string | null
          task_id?: number
          task_name: string
          task_status?: Database["public"]["Enums"]["task_status"]
        }
        Update: {
          dead_line?: string | null
          hex_color?: string | null
          is_archived?: boolean
          task_description?: string | null
          task_id?: number
          task_name?: string
          task_status?: Database["public"]["Enums"]["task_status"]
        }
        Relationships: []
      }
      mondorf_product: {
        Row: {
          description_en: string | null
          description_fr: string | null
          id: number
          name: string | null
          name_en: string | null
          name_fr: string | null
        }
        Insert: {
          description_en?: string | null
          description_fr?: string | null
          id?: number
          name?: string | null
          name_en?: string | null
          name_fr?: string | null
        }
        Update: {
          description_en?: string | null
          description_fr?: string | null
          id?: number
          name?: string | null
          name_en?: string | null
          name_fr?: string | null
        }
        Relationships: []
      }
      offer_manager_chapters: {
        Row: {
          content: string | null
          created_at: string
          id: string
          offer_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          offer_id: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          offer_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_manager_chapters_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offer_manager_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_manager_company_settings: {
        Row: {
          city: string | null
          company_address: string | null
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          postal_code: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          city?: string | null
          company_address?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          postal_code?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          city?: string | null
          company_address?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          postal_code?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      offer_manager_line_items: {
        Row: {
          chapter_id: string
          created_at: string
          description: string
          id: string
          quantity: number
          sort_order: number
          unit_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          chapter_id: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          chapter_id?: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_manager_line_items_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "offer_manager_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_manager_offers: {
        Row: {
          company_address: string | null
          company_city: string | null
          company_contact_email: string | null
          company_contact_name: string | null
          company_contact_phone: string | null
          company_country: string | null
          company_name: string | null
          company_postal_code: string | null
          company_vat: string | null
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_company_name: string | null
          customer_contact_email: string | null
          customer_contact_name: string | null
          customer_contact_phone: string | null
          customer_country: string | null
          customer_postal_code: string | null
          customer_vat: string | null
          id: string
          offer_date: string | null
          offer_number: string | null
          status: Database["public"]["Enums"]["offer_status"]
          title: string
          updated_at: string
          user_id: string
          validity_days: number | null
        }
        Insert: {
          company_address?: string | null
          company_city?: string | null
          company_contact_email?: string | null
          company_contact_name?: string | null
          company_contact_phone?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_vat?: string | null
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_company_name?: string | null
          customer_contact_email?: string | null
          customer_contact_name?: string | null
          customer_contact_phone?: string | null
          customer_country?: string | null
          customer_postal_code?: string | null
          customer_vat?: string | null
          id?: string
          offer_date?: string | null
          offer_number?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title?: string
          updated_at?: string
          user_id: string
          validity_days?: number | null
        }
        Update: {
          company_address?: string | null
          company_city?: string | null
          company_contact_email?: string | null
          company_contact_name?: string | null
          company_contact_phone?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_vat?: string | null
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_company_name?: string | null
          customer_contact_email?: string | null
          customer_contact_name?: string | null
          customer_contact_phone?: string | null
          customer_country?: string | null
          customer_postal_code?: string | null
          customer_vat?: string | null
          id?: string
          offer_date?: string | null
          offer_number?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title?: string
          updated_at?: string
          user_id?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      offer_manager_products: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          unit_price: number
          updated_at: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          unit_price?: number
          updated_at?: string
          user_id: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: []
      }
      rcarre_paperjam_scrapping: {
        Row: {
          address: string | null
          creation_year: string | null
          detail_url: string | null
          general_email: string | null
          info_description: string | null
          is_details_scrapped: boolean | null
          name: string
          phone: string | null
          raw_page_html: string | null
          services: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          creation_year?: string | null
          detail_url?: string | null
          general_email?: string | null
          info_description?: string | null
          is_details_scrapped?: boolean | null
          name?: string
          phone?: string | null
          raw_page_html?: string | null
          services?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          creation_year?: string | null
          detail_url?: string | null
          general_email?: string | null
          info_description?: string | null
          is_details_scrapped?: boolean | null
          name?: string
          phone?: string | null
          raw_page_html?: string | null
          services?: string | null
          website?: string | null
        }
        Relationships: []
      }
      telegram_message: {
        Row: {
          created_at: string
          date: string | null
          id: number
          text: string | null
          user_email: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: number
          text?: string | null
          user_email?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: number
          text?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      telegram_user: {
        Row: {
          chat_id: string
          email: string | null
          user: string | null
        }
        Insert: {
          chat_id: string
          email?: string | null
          user?: string | null
        }
        Update: {
          chat_id?: string
          email?: string | null
          user?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_complete_schema: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_documents: {
        Args: { filter: Json; match_count: number; query_embedding: string }
        Returns: {
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
      controlc_decision:
        | "To decide"
        | "Not interesting"
        | "To be contacted"
        | "Contacted"
      offer_status: "draft" | "sent" | "accepted" | "rejected"
      task_status: "To Do" | "In Progress" | "Waiting for Info" | "Done"
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
      app_role: ["admin", "viewer"],
      controlc_decision: [
        "To decide",
        "Not interesting",
        "To be contacted",
        "Contacted",
      ],
      offer_status: ["draft", "sent", "accepted", "rejected"],
      task_status: ["To Do", "In Progress", "Waiting for Info", "Done"],
    },
  },
} as const
