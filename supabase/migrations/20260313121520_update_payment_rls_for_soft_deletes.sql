/*
  # Update Payment RLS Policies for Soft Deletes

  1. Changes
    - Update all SELECT policies to exclude soft-deleted payments
    - Ensure soft-deleted payments are hidden from normal views
    - Allow admins to view soft-deleted payments in trash view

  2. Policy Updates
    - User and admin SELECT policies now filter out deleted_at IS NOT NULL
    - This ensures trashed invoices' payments don't appear in regular lists
    - Maintains security while respecting soft delete status

  3. Important Notes
    - Regular users cannot see soft-deleted payments
    - Admins can query soft-deleted payments for trash management
    - INSERT/UPDATE/DELETE policies remain unchanged
*/

-- Update user SELECT policy to exclude soft-deleted payments
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id 
    AND deleted_at IS NULL
  );

-- Update admin SELECT policy to show all payments including soft-deleted
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING ((SELECT is_admin(auth.uid())));