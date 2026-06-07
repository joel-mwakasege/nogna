/*
  # Fix Account Balances RLS Security

  1. Security Issue
    - Current policies allow unrestricted access (USING true)
    - This bypasses row-level security completely

  2. Solution
    - Replace overly permissive policies with admin-only access
    - Only admins should modify account balances directly
    - Balance changes should happen through triggers from transactions

  3. Important Notes
    - This significantly improves security
    - Normal users interact with balances through expenses/deposits
    - Balances are automatically updated via triggers
*/

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Users can delete account balances" ON account_balances;
DROP POLICY IF EXISTS "Users can insert account balances" ON account_balances;
DROP POLICY IF EXISTS "Users can update account balances" ON account_balances;

-- Create secure policies that only allow admin access
CREATE POLICY "Admins can delete account balances"
  ON account_balances
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert account balances"
  ON account_balances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update account balances"
  ON account_balances
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- Users can still view balances for accounts they can access
-- This policy already exists and is secure
