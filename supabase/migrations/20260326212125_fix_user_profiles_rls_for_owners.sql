/*
  # Fix User Profiles RLS for Company Owners

  1. Changes
    - Drop old admin-only RLS policies on user_profiles
    - Add new policies that allow both owners and admins to manage users in their company
    - Maintain tenant isolation by company_id

  2. Security
    - Owners can view all users in their company
    - Admins can view all users in their company
    - Regular users can only view their own profile
    - All operations respect company boundaries

  3. Important Notes
    - Fixes the issue where owners cannot delete users via edge function
    - Maintains strict tenant isolation
*/

-- Drop existing policies that only check for admin role
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- Update the is_admin helper function to also check for owner role
CREATE OR REPLACE FUNCTION is_admin_or_owner(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
$$;

-- Create new policies for viewing profiles within the same company
CREATE POLICY "Company admins and owners can view company profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    -- User can view their own profile
    auth.uid() = id
    OR
    -- Owners and admins can view profiles in their company
    (
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role IN ('owner', 'admin')
        AND up.is_active = true
        AND up.company_id = user_profiles.company_id
      )
    )
  );

-- Create new policy for updating profiles within the same company
CREATE POLICY "Company admins and owners can update company profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('owner', 'admin')
      AND up.is_active = true
      AND up.company_id = user_profiles.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('owner', 'admin')
      AND up.is_active = true
      AND up.company_id = user_profiles.company_id
    )
  );

-- Create index for better performance on company_id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_role ON user_profiles(company_id, role) WHERE is_active = true;
