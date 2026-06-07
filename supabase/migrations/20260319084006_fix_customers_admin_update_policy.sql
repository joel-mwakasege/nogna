/*
  # Fix Customer Update Policy for Admins

  1. Changes
    - Drop the existing admin update policy that uses inconsistent logic
    - Create a new admin update policy that uses the is_admin() function consistently
    - Ensure admins can update any customer regardless of user_id ownership

  2. Security
    - Maintains RLS protection
    - Only authenticated admins can update all customers
    - Non-admin users can still only update their own customers
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Admins can update all customers" ON customers;

-- Create the corrected policy using is_admin() function consistently
CREATE POLICY "Admins can update all customers"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));