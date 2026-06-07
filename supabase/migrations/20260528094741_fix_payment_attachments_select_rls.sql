/*
  # Fix payment_attachments SELECT RLS policy

  The previous SELECT policy used get_user_company_id() which is not SECURITY DEFINER
  and can return NULL in RLS context, blocking all reads. Replace with a direct subquery
  join matching the pattern used by other working tables in this codebase.
*/

DROP POLICY IF EXISTS "Company users can view payment attachments" ON payment_attachments;

CREATE POLICY "Company users can view payment attachments"
  ON payment_attachments
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM payments p
      JOIN user_profiles up ON up.company_id = p.company_id
      WHERE p.id = payment_attachments.payment_id
        AND up.id = auth.uid()
    )
  );
