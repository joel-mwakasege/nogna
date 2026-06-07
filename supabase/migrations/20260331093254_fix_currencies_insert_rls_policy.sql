/*
  # Fix Currencies INSERT RLS Policy

  1. Problem
    - INSERT policy requires company_id to match user's company_id
    - Frontend passes company_id but policy check is too restrictive
    - Users cannot add currencies due to RLS violation

  2. Solution
    - Update INSERT policy to allow NULL company_id or matching company_id
    - Add trigger to automatically set company_id from user's profile if not provided

  3. Changes
    - Drop and recreate INSERT policy for currencies
    - Add trigger to auto-populate company_id from user's profile
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Admins can insert company currencies" ON currencies;

-- Create new INSERT policy that allows NULL or matching company_id
CREATE POLICY "Admins can insert company currencies"
  ON currencies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND (
        currencies.company_id = user_profiles.company_id
        OR currencies.company_id IS NULL
      )
    )
  );

-- Create trigger function to auto-populate company_id for currencies
CREATE OR REPLACE FUNCTION set_currency_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM user_profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_set_currency_company_id ON currencies;

-- Create trigger to auto-populate company_id
CREATE TRIGGER trg_set_currency_company_id
  BEFORE INSERT ON currencies
  FOR EACH ROW
  EXECUTE FUNCTION set_currency_company_id();
