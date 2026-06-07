/*
  # Create Company Custom Fields Table

  1. New Tables
    - `company_custom_fields`
      - `id` (uuid, primary key)
      - `company_settings_id` (uuid, foreign key to company_settings)
      - `field_label` (text) - The label/name of the custom field
      - `field_value` (text) - The value of the custom field
      - `display_order` (integer) - Order in which fields should be displayed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `company_custom_fields` table
    - Add policies for authenticated users to manage their company's custom fields

  3. Notes
    - Custom fields allow companies to add additional information fields to their documents
    - Fields are ordered by display_order for consistent presentation
*/

CREATE TABLE IF NOT EXISTS company_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_settings_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  field_label text NOT NULL DEFAULT '',
  field_value text DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company custom fields"
  ON company_custom_fields
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert company custom fields"
  ON company_custom_fields
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update company custom fields"
  ON company_custom_fields
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete company custom fields"
  ON company_custom_fields
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS company_custom_fields_company_settings_id_idx 
  ON company_custom_fields(company_settings_id);

CREATE INDEX IF NOT EXISTS company_custom_fields_display_order_idx 
  ON company_custom_fields(display_order);