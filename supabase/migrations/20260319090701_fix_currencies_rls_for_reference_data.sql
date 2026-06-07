/*
  # Fix Currencies RLS Policy for Reference Data Access

  1. Changes
    - Drop existing restrictive SELECT policy on currencies table
    - Create new policy allowing all authenticated users to view currencies
    - Currencies are reference/lookup data and should be readable by all users
    
  2. Security
    - Keep restrictive policies for INSERT, UPDATE, DELETE (users can only modify their own)
    - Only SELECT policy is relaxed to allow cross-user access for joins
*/

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own currencies" ON currencies;

-- Create new policy allowing all authenticated users to view all currencies
CREATE POLICY "Authenticated users can view all currencies"
  ON currencies
  FOR SELECT
  TO authenticated
  USING (true);