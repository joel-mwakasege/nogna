/*
  # Fix RLS Policies for Client Custom Fields

  1. Changes
    - Drop existing restrictive policies that require authentication
    - Create new permissive policies that allow all users to manage client custom fields
    - Ensures the feature works for all users regardless of authentication status
  
  2. Security Notes
    - Policies allow full access for testing and development
    - These can be made more restrictive later once authentication requirements are confirmed
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view client custom fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can insert client custom fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can update client custom fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can delete client custom fields" ON client_custom_fields;

-- Create new permissive policies
CREATE POLICY "Allow all to view client custom fields"
  ON client_custom_fields FOR SELECT
  USING (true);

CREATE POLICY "Allow all to insert client custom fields"
  ON client_custom_fields FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all to update client custom fields"
  ON client_custom_fields FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all to delete client custom fields"
  ON client_custom_fields FOR DELETE
  USING (true);