/*
  # Fix User Profiles RLS - Remove Recursive Policies

  1. Changes
    - Drop all existing SELECT policies on user_profiles
    - Create a single, simple SELECT policy for authenticated users
    - Keep UPDATE and DELETE policies as they are
  
  2. Security
    - Authenticated users can view all profiles in their company
    - No recursive queries that cause 500 errors
*/

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Company admins and owners can view company profiles" ON user_profiles;

-- Create a simple SELECT policy without recursion
CREATE POLICY "Authenticated users can view profiles in their company"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id 
      FROM auth.users 
      WHERE id = auth.uid()
    )
    OR
    id = auth.uid()
  );
