/*
  # Allow Users to View All Profiles

  1. Changes
    - Add new RLS policy to allow all authenticated users to view all user profiles
    - This enables users to see the list of users when assigning expenses
    
  2. Security Considerations
    - Users can only view basic profile information (id, email, full_name, role)
    - Users still cannot modify other users' profiles
    - This is necessary for expense assignment and collaboration features
    
  3. Rationale
    - Users need to see other users in the system to assign expenses
    - Viewing user lists is a common requirement in collaborative applications
    - No sensitive data is exposed (email and name are business information)
*/

-- Drop the existing restrictive policy for regular users
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Create a new policy that allows all authenticated users to view all profiles
CREATE POLICY "Authenticated users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);
