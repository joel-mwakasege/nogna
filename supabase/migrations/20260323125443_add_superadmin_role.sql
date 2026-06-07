/*
  # Add SuperAdmin Role

  1. Changes
    - Add 'superadmin' role to user_profiles role check constraint
    - SuperAdmins have no company_id and can manage all companies
  
  2. Notes
    - SuperAdmins are platform administrators, not company owners
    - They should not be associated with any specific company
*/

-- Drop the existing constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add the new constraint with superadmin included
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('owner', 'admin', 'user', 'superadmin'));