/*
  # Add User Authentication and Update RLS Policies
  
  1. Schema Changes
    - Add user_id column to all main tables
    - Create indexes on user_id columns for performance
  
  2. RLS Policy Updates
    - Drop old permissive policies that allowed public/anon access
    - Create new restrictive policies that check auth.uid()
    - Users can only access their own data
  
  3. Security
    - All tables now enforce user-based access control
    - Only authenticated users can perform operations
    - Each user can only see/modify their own records
*/

-- Add user_id column to all tables
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE document_sections ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE document_line_items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE custom_line_items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE client_details ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE document_client_fields ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE client_custom_fields ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE company_custom_fields ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_user_id ON document_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_document_line_items_user_id ON document_line_items(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_line_items_user_id ON custom_line_items(user_id);
CREATE INDEX IF NOT EXISTS idx_client_details_user_id ON client_details(user_id);
CREATE INDEX IF NOT EXISTS idx_document_client_fields_user_id ON document_client_fields(user_id);
CREATE INDEX IF NOT EXISTS idx_client_custom_fields_user_id ON client_custom_fields(user_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_company_custom_fields_user_id ON company_custom_fields(user_id);

-- Update customers table RLS policies
DROP POLICY IF EXISTS "Enable all operations for customers" ON customers;

CREATE POLICY "Users can view own customers"
  ON customers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers"
  ON customers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update documents table RLS policies
DROP POLICY IF EXISTS "Enable all operations for documents" ON documents;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update document_sections table RLS policies
DROP POLICY IF EXISTS "Enable all operations for document sections" ON document_sections;

CREATE POLICY "Users can view own document_sections"
  ON document_sections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own document_sections"
  ON document_sections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document_sections"
  ON document_sections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own document_sections"
  ON document_sections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update document_line_items table RLS policies
DROP POLICY IF EXISTS "Enable all operations for document line items" ON document_line_items;

CREATE POLICY "Users can view own document_line_items"
  ON document_line_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own document_line_items"
  ON document_line_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document_line_items"
  ON document_line_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own document_line_items"
  ON document_line_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update accounts table RLS policies
DROP POLICY IF EXISTS "Enable all operations for accounts" ON accounts;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update payments table RLS policies
DROP POLICY IF EXISTS "Enable all operations for payments" ON payments;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payments"
  ON payments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update custom_line_items table RLS policies
DROP POLICY IF EXISTS "Enable all operations for custom line items" ON custom_line_items;

CREATE POLICY "Users can view own custom_line_items"
  ON custom_line_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom_line_items"
  ON custom_line_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom_line_items"
  ON custom_line_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom_line_items"
  ON custom_line_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update client_details table RLS policies
DROP POLICY IF EXISTS "Enable all operations for client details" ON client_details;

CREATE POLICY "Users can view own client_details"
  ON client_details FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client_details"
  ON client_details FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own client_details"
  ON client_details FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own client_details"
  ON client_details FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update document_client_fields table RLS policies
DROP POLICY IF EXISTS "Enable all operations for document client fields" ON document_client_fields;

CREATE POLICY "Users can view own document_client_fields"
  ON document_client_fields FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own document_client_fields"
  ON document_client_fields FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document_client_fields"
  ON document_client_fields FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own document_client_fields"
  ON document_client_fields FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update client_custom_fields table RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage client custom fields" ON client_custom_fields;

CREATE POLICY "Users can view own client_custom_fields"
  ON client_custom_fields FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client_custom_fields"
  ON client_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own client_custom_fields"
  ON client_custom_fields FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own client_custom_fields"
  ON client_custom_fields FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update company_settings table RLS policies
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;

CREATE POLICY "Users can view own company_settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company_settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company_settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own company_settings"
  ON company_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update company_custom_fields table RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage company custom fields" ON company_custom_fields;

CREATE POLICY "Users can view own company_custom_fields"
  ON company_custom_fields FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company_custom_fields"
  ON company_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company_custom_fields"
  ON company_custom_fields FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own company_custom_fields"
  ON company_custom_fields FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
