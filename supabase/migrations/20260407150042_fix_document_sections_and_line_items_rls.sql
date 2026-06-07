/*
  # Fix RLS Policies for Document Sections and Line Items
  
  1. Changes
    - Add proper RLS policies for document_sections table
    - Add proper RLS policies for document_line_items table
    - Add proper RLS policies for client_custom_fields table
    - Policies check company_id via the parent documents table
    
  2. Security
    - Users can only access sections/items/fields for documents in their company
    - Admins can manage all sections/items/fields in their company
    - Uses JOIN to documents table to verify company_id
    
  3. Important Notes
    - These tables don't have company_id directly
    - Security is enforced via parent document's company_id
    - This maintains proper multi-tenant isolation
*/

-- Drop old user_id based policies for document_sections
DROP POLICY IF EXISTS "Users can view own document_sections" ON document_sections;
DROP POLICY IF EXISTS "Users can insert own document_sections" ON document_sections;
DROP POLICY IF EXISTS "Users can update own document_sections" ON document_sections;
DROP POLICY IF EXISTS "Users can delete own document_sections" ON document_sections;
DROP POLICY IF EXISTS "Admins can manage all document_sections" ON document_sections;

-- Create new company-based policies for document_sections
CREATE POLICY "Users can view document_sections in their company"
  ON document_sections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_sections.document_id
      AND documents.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins can insert document_sections in their company"
  ON document_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      JOIN user_profiles ON user_profiles.id = auth.uid()
      WHERE documents.id = document_sections.document_id
      AND documents.company_id = user_profiles.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update document_sections in their company"
  ON document_sections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      JOIN user_profiles ON user_profiles.id = auth.uid()
      WHERE documents.id = document_sections.document_id
      AND documents.company_id = user_profiles.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      JOIN user_profiles ON user_profiles.id = auth.uid()
      WHERE documents.id = document_sections.document_id
      AND documents.company_id = user_profiles.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete document_sections in their company"
  ON document_sections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      JOIN user_profiles ON user_profiles.id = auth.uid()
      WHERE documents.id = document_sections.document_id
      AND documents.company_id = user_profiles.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Drop old user_id based policies for document_line_items
DROP POLICY IF EXISTS "Users can view own document_line_items" ON document_line_items;
DROP POLICY IF EXISTS "Users can insert own document_line_items" ON document_line_items;
DROP POLICY IF EXISTS "Users can update own document_line_items" ON document_line_items;
DROP POLICY IF EXISTS "Users can delete own document_line_items" ON document_line_items;
DROP POLICY IF EXISTS "Admins can manage all document_line_items" ON document_line_items;

-- Create new company-based policies for document_line_items
CREATE POLICY "Users can view document_line_items in their company"
  ON document_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_sections
      JOIN documents ON documents.id = document_sections.document_id
      WHERE document_sections.id = document_line_items.section_id
      AND documents.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins can insert document_line_items in their company"
  ON document_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_sections
      JOIN documents ON documents.id = document_sections.document_id
      JOIN user_profiles ON user_profiles.id = auth.uid()
      WHERE document_sections.id = document_line_items.section_id
      AND documents.company_id = user_profiles.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update document_line_items in their company"
  ON document_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_sections
      JOIN documents ON documents.id = document_sections.document_id
      JOIN user_profiles ON user_profiles.id = auth.uid()
      WHERE document_sections.id = document_line_items.section_id
      AND documents.company_id = user_profiles.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_sections
      JOIN documents ON documents.id = document_sections.document_id
      JOIN user_profiles ON user_profiles.id = auth.uid()
      WHERE document_sections.id = document_line_items.section_id
      AND documents.company_id = user_profiles.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete document_line_items in their company"
  ON document_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_sections
      JOIN documents ON documents.id = document_sections.document_id
      JOIN user_profiles ON user_profiles.id = auth.uid()
      WHERE document_sections.id = document_line_items.section_id
      AND documents.company_id = user_profiles.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Drop old policies for client_custom_fields
DROP POLICY IF EXISTS "Users can view own client_custom_fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can insert own client_custom_fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can update own client_custom_fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can delete own client_custom_fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Admins can manage all client_custom_fields" ON client_custom_fields;

-- Create new company-based policies for client_custom_fields
CREATE POLICY "Users can view client_custom_fields in their company"
  ON client_custom_fields FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Admins can insert client_custom_fields in their company"
  ON client_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.company_id = client_custom_fields.company_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update client_custom_fields in their company"
  ON client_custom_fields FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete client_custom_fields in their company"
  ON client_custom_fields FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );