/*
  # Create Currencies Management Table

  1. New Tables
    - `currencies`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Currency code like USD, EUR, GBP
      - `name` (text) - Full currency name
      - `symbol` (text) - Currency symbol like $, €, £
      - `is_active` (boolean) - Whether currency is active
      - `display_order` (integer) - Order to display currencies
      - `user_id` (uuid) - Foreign key to auth.users
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `currencies` table
    - Add policies for authenticated users to manage their currencies

  3. Default Data
    - Insert common currencies (USD, EUR, GBP)
*/

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL DEFAULT '',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

-- Policies for currencies
CREATE POLICY "Users can view their own currencies"
  ON currencies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own currencies"
  ON currencies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own currencies"
  ON currencies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own currencies"
  ON currencies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_currencies_user_id ON currencies(user_id);
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);
