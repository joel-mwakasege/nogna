/*
  # Add User Deletion Policies for Company Owners

  1. Changes
    - Add RLS policy allowing company owners to delete users from their company
    - Ensures owners cannot delete themselves
    - Maintains data integrity by preventing deletion of users with active references
  
  2. Security
    - Only company owners can delete users
    - Users cannot delete themselves (must transfer ownership first)
    - Respects existing foreign key constraints
*/

-- Allow company owners to delete users from their company (except themselves)
CREATE POLICY "Company owners can delete other users in their company"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'owner'
    )
    AND id != auth.uid()  -- Cannot delete yourself
  );