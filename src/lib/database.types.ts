export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          name: string
          account_type: 'bank_account' | 'paypal' | 'stripe' | 'cash' | 'other'
          account_number: string | null
          currency: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          account_type?: 'bank_account' | 'paypal' | 'stripe' | 'cash' | 'other'
          account_number?: string | null
          currency?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          account_type?: 'bank_account' | 'paypal' | 'stripe' | 'cash' | 'other'
          account_number?: string | null
          currency?: string
          is_active?: boolean
          created_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          document_number: string
          document_type: 'invoice' | 'quote'
          customer_id: string | null
          currency: string
          issue_date: string
          status: 'draft' | 'unpaid' | 'paid' | 'partially_paid' | 'overdue'
          discount_percent: number
          tax_percent: number
          remarks: string | null
          contact_person: string | null
          po_number: string | null
          location: string | null
          tin: string | null
          vrn: string | null
          administrative_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_number: string
          document_type: 'invoice' | 'quote'
          customer_id?: string | null
          currency?: string
          issue_date?: string
          status?: 'draft' | 'unpaid' | 'paid' | 'partially_paid' | 'overdue'
          discount_percent?: number
          tax_percent?: number
          remarks?: string | null
          contact_person?: string | null
          po_number?: string | null
          location?: string | null
          tin?: string | null
          vrn?: string | null
          administrative_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_number?: string
          document_type?: 'invoice' | 'quote'
          customer_id?: string | null
          currency?: string
          issue_date?: string
          status?: 'draft' | 'unpaid' | 'paid' | 'partially_paid' | 'overdue'
          discount_percent?: number
          tax_percent?: number
          remarks?: string | null
          contact_person?: string | null
          po_number?: string | null
          location?: string | null
          tin?: string | null
          vrn?: string | null
          administrative_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      document_sections: {
        Row: {
          id: string
          document_id: string
          name: string
          sort_order: number
          units_multiplier: number
          hide_header: boolean
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          name: string
          sort_order?: number
          units_multiplier?: number
          hide_header?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          name?: string
          sort_order?: number
          units_multiplier?: number
          hide_header?: boolean
          created_at?: string
        }
      }
      document_line_items: {
        Row: {
          id: string
          section_id: string
          description: string
          units: number
          days: number
          unit_cost: number
          sort_order: number
          remarks: string | null
          group_id: string | null
          is_group_parent: boolean
          created_at: string
        }
        Insert: {
          id?: string
          section_id: string
          description: string
          units?: number
          days?: number
          unit_cost?: number
          sort_order?: number
          remarks?: string | null
          group_id?: string | null
          is_group_parent?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          description?: string
          units?: number
          days?: number
          unit_cost?: number
          sort_order?: number
          remarks?: string | null
          group_id?: string | null
          is_group_parent?: boolean
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          document_id: string
          account_id: string
          amount: number
          currency: string
          payment_date: string
          payment_method: 'bank_transfer' | 'credit_card' | 'paypal' | 'stripe' | 'cash' | 'check' | 'other'
          reference_number: string | null
          notes: string | null
          created_at: string
          created_by: string | null
          user_id: string | null
          company_id: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          document_id: string
          account_id: string
          amount: number
          currency?: string
          payment_date?: string
          payment_method?: 'bank_transfer' | 'credit_card' | 'paypal' | 'stripe' | 'cash' | 'check' | 'other'
          reference_number?: string | null
          notes?: string | null
          created_at?: string
          created_by?: string | null
          user_id?: string | null
          company_id?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          document_id?: string
          account_id?: string
          amount?: number
          currency?: string
          payment_date?: string
          payment_method?: 'bank_transfer' | 'credit_card' | 'paypal' | 'stripe' | 'cash' | 'check' | 'other'
          reference_number?: string | null
          notes?: string | null
          created_at?: string
          created_by?: string | null
          user_id?: string | null
          company_id?: string | null
          deleted_at?: string | null
        }
      }
      custom_line_items: {
        Row: {
          id: string
          document_id: string
          name: string
          description: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          name: string
          description?: string | null
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          name?: string
          description?: string | null
          display_order?: number
          created_at?: string
        }
      }
      client_custom_fields: {
        Row: {
          id: string
          document_id: string
          field_label: string
          field_value: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          field_label: string
          field_value?: string | null
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          field_label?: string
          field_value?: string | null
          display_order?: number
          created_at?: string
        }
      }
      default_client_fields: {
        Row: {
          id: string
          field_label: string
          field_value: string
          display_order: number
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          field_label: string
          field_value?: string
          display_order?: number
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          field_label?: string
          field_value?: string
          display_order?: number
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      company_settings: {
        Row: {
          id: string
          company_name: string
          logo_url: string
          letterhead_url: string | null
          address_line1: string
          address_line2: string
          city: string
          state: string
          zip_code: string
          country: string
          phone: string
          email: string
          bank_name: string
          account_number: string
          routing_number: string
          account_holder_name: string
          document_numbering_mode: 'auto' | 'manual'
          document_number_prefix: string
          document_number_counter: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name?: string
          logo_url?: string
          letterhead_url?: string | null
          address_line1?: string
          address_line2?: string
          city?: string
          state?: string
          zip_code?: string
          country?: string
          phone?: string
          email?: string
          bank_name?: string
          account_number?: string
          routing_number?: string
          account_holder_name?: string
          document_numbering_mode?: 'auto' | 'manual'
          document_number_prefix?: string
          document_number_counter?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          logo_url?: string
          letterhead_url?: string | null
          address_line1?: string
          address_line2?: string
          city?: string
          state?: string
          zip_code?: string
          country?: string
          phone?: string
          email?: string
          bank_name?: string
          account_number?: string
          routing_number?: string
          account_holder_name?: string
          document_numbering_mode?: 'auto' | 'manual'
          document_number_prefix?: string
          document_number_counter?: number
          created_at?: string
          updated_at?: string
        }
      }
      company_custom_fields: {
        Row: {
          id: string
          company_settings_id: string
          field_label: string
          field_value: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          company_settings_id: string
          field_label: string
          field_value: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          company_settings_id?: string
          field_label?: string
          field_value?: string
          display_order?: number
          created_at?: string
        }
      }
    }
  }
}
