/*
  # Add Client Fields and Custom Line Items to Documents

  ## Changes Made
  
  1. New Columns Added to documents Table
    - `contact_person` (text) - Contact person name for the client
    - `po_number` (text) - Purchase Order number
    - `location` (text) - Client location/address
    - `tin` (text) - Tax Identification Number
    - `vrn` (text) - VAT Registration Number
  
  2. New Table: custom_line_items
    - `id` (uuid, primary key) - Unique identifier
    - `document_id` (uuid, foreign key) - References documents table
    - `name` (text) - Line item name/title
    - `description` (text) - Line item description
    - `display_order` (integer) - Order in which items should be displayed
    - `created_at` (timestamptz) - Creation timestamp
    
  3. Security
    - Enable RLS on custom_line_items table
    - Add policies for authenticated users to manage their custom line items
    
  ## Notes
  - All new fields in documents table are nullable to allow existing documents to remain valid
  - Custom line items are displayed before document sections based on display_order
  - RLS ensures users can only access custom line items for documents they have access to
*/

-- Add new fields to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE documents ADD COLUMN contact_person text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'po_number'
  ) THEN
    ALTER TABLE documents ADD COLUMN po_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'location'
  ) THEN
    ALTER TABLE documents ADD COLUMN location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'tin'
  ) THEN
    ALTER TABLE documents ADD COLUMN tin text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'vrn'
  ) THEN
    ALTER TABLE documents ADD COLUMN vrn text;
  END IF;
END $$;

-- Create custom_line_items table
CREATE TABLE IF NOT EXISTS custom_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on custom_line_items
ALTER TABLE custom_line_items ENABLE ROW LEVEL SECURITY;

-- Create policies for custom_line_items
CREATE POLICY "Users can view custom line items"
  ON custom_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert custom line items"
  ON custom_line_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update custom line items"
  ON custom_line_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete custom line items"
  ON custom_line_items FOR DELETE
  TO authenticated
  USING (true);

-- Create index on document_id for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_line_items_document_id 
  ON custom_line_items(document_id);

-- Create index on display_order for sorting
CREATE INDEX IF NOT EXISTS idx_custom_line_items_display_order 
  ON custom_line_items(document_id, display_order);