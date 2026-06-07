/*
  # Fix Expenses and Deposits RLS Policies
  
  1. Changes
    - Remove duplicate and conflicting policies
    - Simplify to company-based access control
    - Allow all authenticated users in the same company to manage records
    
  2. Security
    - Users can only access expenses/deposits in their own company
    - Maintains soft delete and trash functionality
    - SAAS admins have full access
    
  3. Important Notes
    - Fixes overly restrictive policies that prevented owners/users from creating records
    - Maintains proper company isolation for multi-tenancy
*/

-- ============================================================================
-- EXPENSES: Drop all existing policies
-- ============================================================================
DROP POLICY IF EXISTS "Admins can create expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can update expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can view all expense trash" ON expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can view all expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses or admins can delete any" ON expenses;
DROP POLICY IF EXISTS "Users can insert their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view own expense trash" ON expenses;
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;

-- ============================================================================
-- EXPENSES: Create simplified RLS policies
-- ============================================================================
CREATE POLICY "Users can view expenses in their company"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can view deleted expenses in their company"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    AND deleted_at IS NOT NULL
  );

CREATE POLICY "Users can insert expenses in their company"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update expenses in their company"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete expenses in their company"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- SAAS Admin override policy
CREATE POLICY "SAAS admins have full access to all expenses"
  ON expenses FOR ALL
  TO authenticated
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));

-- ============================================================================
-- DEPOSITS: Drop all existing policies
-- ============================================================================
DROP POLICY IF EXISTS "Admins can create deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can hard delete deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can insert deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can soft delete deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can update deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can update non-deleted deposits" ON deposits;
DROP POLICY IF EXISTS "Users can view deposits" ON deposits;
DROP POLICY IF EXISTS "Users can view non-deleted deposits" ON deposits;
DROP POLICY IF EXISTS "Users can view their own deleted deposits in trash" ON deposits;

-- ============================================================================
-- DEPOSITS: Create simplified RLS policies
-- ============================================================================
CREATE POLICY "Users can view deposits in their company"
  ON deposits FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can view deleted deposits in their company"
  ON deposits FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    AND deleted_at IS NOT NULL
  );

CREATE POLICY "Users can insert deposits in their company"
  ON deposits FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update deposits in their company"
  ON deposits FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete deposits in their company"
  ON deposits FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- SAAS Admin override policy
CREATE POLICY "SAAS admins have full access to all deposits"
  ON deposits FOR ALL
  TO authenticated
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));