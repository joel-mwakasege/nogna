/*
  # Add Company ID to Payments Table
  
  1. Changes
    - Add company_id column to payments table
    - Add foreign key constraint to companies table
    - Create index for performance
    - Update RLS policies to use company_id for proper multi-tenancy support
    
  2. Security
    - Update RLS policies to check company_id from user's profile
    - Maintain existing user_id checks as secondary validation
    
  3. Important Notes
    - This completes multi-tenant support for the payments table
    - Payments will now be scoped to companies, not just users
*/

-- Add company_id to payments table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
  END IF;
END $$;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Admins can insert all payments" ON payments;
DROP POLICY IF EXISTS "Admins can update all payments" ON payments;
DROP POLICY IF EXISTS "Admins can delete all payments" ON payments;

-- Create new RLS policies with company_id filtering
CREATE POLICY "Users can view company payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can insert company payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update company payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete company payments"
  ON payments FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can view all payments in company"
  ON payments FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    AND company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert payments in company"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    AND company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can update payments in company"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    AND company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    is_admin(auth.uid())
    AND company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can delete payments in company"
  ON payments FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid())
    AND company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  );

-- SAAS Admin policies
CREATE POLICY "SAAS admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (is_saas_admin(auth.uid()));

CREATE POLICY "SAAS admins can insert payments in any company"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (is_saas_admin(auth.uid()));

CREATE POLICY "SAAS admins can update all payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));

CREATE POLICY "SAAS admins can delete all payments"
  ON payments FOR DELETE
  TO authenticated
  USING (is_saas_admin(auth.uid()));