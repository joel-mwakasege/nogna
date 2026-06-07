/*
  # Fix Customers RLS Policies for Owners

  1. Problem
    - Duplicate RLS policies causing conflicts
    - Old policies only check for 'admin' role, excluding 'owner' role
    - The `is_admin()` function only returns true for 'admin', not 'owner'
    - This prevents owners from seeing their company's customers

  2. Solution
    - Drop the old restrictive policies that use `is_admin()` function
    - Drop the old policies that only check for 'admin' role
    - Keep the newer policies that properly check for both 'admin' AND 'owner' roles
    - Update `is_admin()` function to include owners

  3. Security
    - Maintains proper company isolation via company_id
    - Ensures owners and admins can manage their company data
    - Regular users can still only manage their own data
*/

-- Update the is_admin function to include owners
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN user_role IN ('admin', 'owner');
END;
$function$;

-- Drop duplicate/conflicting policies
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
DROP POLICY IF EXISTS "Admins can insert all customers" ON customers;
DROP POLICY IF EXISTS "Admins can update all customers" ON customers;
DROP POLICY IF EXISTS "Admins can delete all customers" ON customers;
DROP POLICY IF EXISTS "Admins can view all customer trash" ON customers;
