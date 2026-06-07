/*
  # Remove Anonymous Access to Company Settings

  1. Changes
    - Drop policy allowing anonymous users to read company_settings
    - Company settings should only be accessible to authenticated users
  
  2. Security
    - Removes public access to company settings
    - Only authenticated users can access company settings
*/

DROP POLICY IF EXISTS "Allow anonymous users to read company settings" ON company_settings;