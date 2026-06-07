/*
  # Fix Company Custom Fields RLS Policies

  1. Changes
    - Drop existing RLS policies on company_custom_fields that require authentication
    - Add new policies that allow anyone to perform operations (matching company_settings table)
    
  2. Rationale
    - This app is designed for single-user context
    - company_settings table already allows anyone to perform operations
    - company_custom_fields should have consistent access patterns with company_settings
    
  3. Security
    - Maintains RLS enabled
    - Allows public access for single-user application context
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view company custom fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Users can insert company custom fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Users can update company custom fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Users can delete company custom fields" ON company_custom_fields;

-- Create new open policies matching company_settings pattern
CREATE POLICY "Anyone can read company custom fields"
  ON company_custom_fields
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert company custom fields"
  ON company_custom_fields
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update company custom fields"
  ON company_custom_fields
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete company custom fields"
  ON company_custom_fields
  FOR DELETE
  USING (true);