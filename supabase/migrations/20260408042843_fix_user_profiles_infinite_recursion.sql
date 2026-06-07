/*
  # Fix User Profiles Infinite Recursion in RLS

  1. Problem
    - Current RLS policy queries user_profiles table within its own policy
    - This creates infinite recursion: "infinite recursion detected in policy for relation user_profiles"
    - Users cannot load any data because company_id lookup fails
    
  2. Solution
    - Use get_user_company_id() function with SECURITY DEFINER
    - This function bypasses RLS and breaks the recursion cycle
    - Also allow users to view their own profile directly
    
  3. Security
    - Users can view their own profile
    - Users can view profiles in their company (using safe function)
    - SAAS admins can view all profiles
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
DROP POLICY IF EXISTS "SAAS admins can view all profiles" ON user_profiles;

-- Allow users to view their own profile (no recursion)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow users to view profiles in their company (using safe function to avoid recursion)
CREATE POLICY "Users can view company profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL 
    AND company_id = get_user_company_id(auth.uid())
  );

-- SAAS Admin override policy
CREATE POLICY "SAAS admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_saas_admin(auth.uid()));
