/*
  # Revert Anonymous Access to Company Settings

  1. Changes
    - Remove policy that allows anonymous users to read company_settings
    - Company settings should only be accessible to authenticated users
  
  2. Security
    - Removes public access to company settings
    - Only authenticated users can view company information
*/

DROP POLICY IF EXISTS "Allow anonymous users to read company settings" ON company_settings;