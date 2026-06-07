/*
  # Fix Customer Delete Policy for Admins

  1. Changes
    - Drop the existing admin delete policy that uses EXISTS subquery
    - Create a new admin delete policy that uses the is_admin() function for consistency
    - Ensure admins can delete any customer regardless of user_id ownership

  2. Security
    - Maintains RLS protection
    - Only authenticated admins can delete all customers
    - Non-admin users can still only delete their own customers
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Admins can delete all customers" ON customers;

-- Create the corrected policy using is_admin() function consistently
CREATE POLICY "Admins can delete all customers"
  ON customers
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));