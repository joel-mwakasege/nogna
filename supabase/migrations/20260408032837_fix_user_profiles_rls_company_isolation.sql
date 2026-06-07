/*
  # Fix User Profiles RLS for Company Isolation
  
  1. Changes
    - Remove overly permissive policy that allows viewing all user profiles
    - Ensure users can only see profiles within their own company
    - Add SAAS admin override for cross-company access
    
  2. Security
    - Enforces proper company isolation for multi-tenancy
    - Users can only view profiles in their own company
    - SAAS admins can view all profiles across companies
    
  3. Important Notes
    - Fixes security issue where SAAS admin users appeared in company user lists
    - Maintains ability to view own profile and company members
*/

-- ============================================================================
-- USER_PROFILES: Drop conflicting policies
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles in their company" ON user_profiles;

-- ============================================================================
-- USER_PROFILES: Create company-isolated SELECT policies
-- ============================================================================
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- SAAS Admin override policy for cross-company access
CREATE POLICY "SAAS admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_saas_admin(auth.uid()));