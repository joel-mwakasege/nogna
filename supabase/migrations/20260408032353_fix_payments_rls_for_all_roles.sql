/*
  # Fix Payments RLS for All User Roles
  
  1. Changes
    - Update RLS policies to allow all authenticated users in the same company
    - Separate policies for regular users vs admins/owners is unnecessary
    - Simplify to just check company_id matching
    
  2. Security
    - Users can only access payments in their own company
    - SAAS admins can access all payments across companies
    
  3. Important Notes
    - Fixes issue where owners and regular users couldn't add payments
    - Maintains company isolation for multi-tenancy
*/

-- Drop all existing payment policies
DROP POLICY IF EXISTS "Users can view company payments" ON payments;
DROP POLICY IF EXISTS "Users can insert company payments" ON payments;
DROP POLICY IF EXISTS "Users can update company payments" ON payments;
DROP POLICY IF EXISTS "Users can delete company payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments in company" ON payments;
DROP POLICY IF EXISTS "Admins can insert payments in company" ON payments;
DROP POLICY IF EXISTS "Admins can update payments in company" ON payments;
DROP POLICY IF EXISTS "Admins can delete payments in company" ON payments;
DROP POLICY IF EXISTS "SAAS admins can view all payments" ON payments;
DROP POLICY IF EXISTS "SAAS admins can insert payments in any company" ON payments;
DROP POLICY IF EXISTS "SAAS admins can update all payments" ON payments;
DROP POLICY IF EXISTS "SAAS admins can delete all payments" ON payments;

-- Create simplified RLS policies
CREATE POLICY "Users can view payments in their company"
  ON payments FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can insert payments in their company"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update payments in their company"
  ON payments FOR UPDATE
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

CREATE POLICY "Users can delete payments in their company"
  ON payments FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- SAAS Admin override policies
CREATE POLICY "SAAS admins have full access to all payments"
  ON payments FOR ALL
  TO authenticated
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));