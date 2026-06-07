/*
  # Create Client Custom Fields Table

  ## Changes Made
  
  1. New Table: client_custom_fields
    - `id` (uuid, primary key) - Unique identifier
    - `document_id` (uuid, foreign key) - References documents table
    - `field_label` (text) - The label/name of the field (e.g., "Contact Person", "PO Number")
    - `field_value` (text) - The value of the field
    - `display_order` (integer) - Order in which fields should be displayed
    - `created_at` (timestamptz) - Creation timestamp
    
  2. Security
    - Enable RLS on client_custom_fields table
    - Add policies for authenticated users to manage their client custom fields
    
  ## Notes
  - This table provides flexibility for clients to add any custom fields they need
  - Both field_label and field_value are editable
  - Fields are displayed in order based on display_order
  - Replaces hardcoded fields like contact_person, po_number, location, tin, vrn
*/

-- Create client_custom_fields table
CREATE TABLE IF NOT EXISTS client_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_label text NOT NULL,
  field_value text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on client_custom_fields
ALTER TABLE client_custom_fields ENABLE ROW LEVEL SECURITY;

-- Create policies for client_custom_fields
CREATE POLICY "Users can view client custom fields"
  ON client_custom_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert client custom fields"
  ON client_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update client custom fields"
  ON client_custom_fields FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete client custom fields"
  ON client_custom_fields FOR DELETE
  TO authenticated
  USING (true);

-- Create index on document_id for better query performance
CREATE INDEX IF NOT EXISTS idx_client_custom_fields_document_id 
  ON client_custom_fields(document_id);

-- Create index on display_order for sorting
CREATE INDEX IF NOT EXISTS idx_client_custom_fields_display_order 
  ON client_custom_fields(document_id, display_order);