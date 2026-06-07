/*
  # Restore Anonymous Access to Company Settings

  1. Changes
    - Re-add policy allowing anonymous users to read company_settings
    - Needed for displaying company information on login/register pages
  
  2. Security
    - Anonymous users can only SELECT from company_settings
    - Write operations still require authentication
*/

CREATE POLICY "Allow anonymous users to read company settings"
  ON company_settings
  FOR SELECT
  TO anon
  USING (true);