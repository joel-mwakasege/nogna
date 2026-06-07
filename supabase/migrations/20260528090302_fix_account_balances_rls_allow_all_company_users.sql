/*
  # Fix account_balances RLS policies

  ## Problem
  INSERT and UPDATE policies on account_balances only allow users with role 'admin',
  blocking 'owner' and 'user' roles from writing balance records when creating
  deposits, expenses, or transfers.

  ## Changes
  - Drop the overly-restrictive admin-only INSERT, UPDATE, DELETE policies
  - Add new policies that allow any authenticated user belonging to the same company
    (via the linked accounts table) to insert, update, and delete balance rows
  - This matches the pattern used by the accounts table itself
*/

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Admins can insert account balances" ON account_balances;
DROP POLICY IF EXISTS "Admins can update account balances" ON account_balances;
DROP POLICY IF EXISTS "Admins can delete account balances" ON account_balances;

-- Allow any company member to insert balance rows for accounts in their company
CREATE POLICY "Company users can insert account balances"
  ON account_balances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_balances.account_id
        AND accounts.company_id = get_user_company_id(auth.uid())
    )
  );

-- Allow any company member to update balance rows for accounts in their company
CREATE POLICY "Company users can update account balances"
  ON account_balances
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_balances.account_id
        AND accounts.company_id = get_user_company_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_balances.account_id
        AND accounts.company_id = get_user_company_id(auth.uid())
    )
  );

-- Allow any company member to delete balance rows for accounts in their company
CREATE POLICY "Company users can delete account balances"
  ON account_balances
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_balances.account_id
        AND accounts.company_id = get_user_company_id(auth.uid())
    )
  );
