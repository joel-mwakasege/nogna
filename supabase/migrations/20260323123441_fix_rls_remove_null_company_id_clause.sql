/*
  # Fix RLS Policies - Remove NULL Company ID Clause

  1. Changes
    - Remove `OR company_id IS NULL` from all RLS policies
    - This ensures strict company isolation - users can ONLY see data from their own company
    - Records without a company_id will not be visible to anyone (orphaned data)
  
  2. Security
    - Enforces proper multi-tenant data isolation
    - Prevents users from seeing data from other companies
    - Prevents users from seeing orphaned data without company assignment
  
  3. Important Notes
    - Any existing data with NULL company_id will become invisible
    - All new records MUST have company_id set properly
    - This is the correct behavior for a multi-tenant system
*/

-- Update RLS policies for customers - strict company filtering
DROP POLICY IF EXISTS "Users can view customers" ON customers;
CREATE POLICY "Users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

-- Update RLS policies for documents - strict company filtering
DROP POLICY IF EXISTS "Users can view documents" ON documents;
CREATE POLICY "Users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

-- Update RLS policies for accounts - strict company filtering
DROP POLICY IF EXISTS "Users can view accounts" ON accounts;
CREATE POLICY "Users can view accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

-- Update RLS policies for expenses - strict company filtering
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
CREATE POLICY "Users can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

-- Update RLS policies for deposits - strict company filtering
DROP POLICY IF EXISTS "Users can view deposits" ON deposits;
CREATE POLICY "Users can view deposits"
  ON deposits FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

-- Update company_settings RLS policies - strict company filtering
DROP POLICY IF EXISTS "Users can view company settings" ON company_settings;
CREATE POLICY "Users can view company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );
