/*
  # Allow Viewing Unassigned Accounts

  1. Changes
    - Update the "Users can view own accounts" policy to also allow viewing accounts with no user_id
    - This enables shared/company accounts to be visible to all authenticated users
    
  2. Security Considerations
    - Accounts with user_id = NULL are treated as shared/company accounts
    - Users can still only view their own assigned accounts plus shared accounts
    - This pattern is common for organization-wide resources
    
  3. Rationale
    - Many accounts in the system are shared company accounts (e.g., "NMB", "Petty Cash")
    - These need to be visible to all users for expense tracking
    - Personal accounts (with user_id set) remain private to their owner
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;

-- Create a new policy that allows viewing owned accounts OR unassigned accounts
CREATE POLICY "Users can view own and shared accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR user_id IS NULL
  );
