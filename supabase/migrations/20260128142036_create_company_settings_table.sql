/*
  # Create company settings table

  1. New Tables
    - `company_settings`
      - `id` (uuid, primary key) - Unique identifier for the settings record
      - `company_name` (text) - Name of the company
      - `logo_url` (text) - URL to the company logo image
      - `address_line1` (text) - First line of company address
      - `address_line2` (text) - Second line of company address (optional)
      - `city` (text) - City
      - `state` (text) - State/Province
      - `zip_code` (text) - ZIP/Postal code
      - `country` (text) - Country
      - `phone` (text) - Company phone number
      - `email` (text) - Company email address
      - `bank_name` (text) - Bank name for payment details
      - `account_number` (text) - Bank account number
      - `routing_number` (text) - Bank routing number
      - `account_holder_name` (text) - Name on bank account
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  2. Security
    - Enable RLS on `company_settings` table
    - Add policy for anyone to read company settings
    - Add policy for anyone to update company settings (single-user app context)

  3. Notes
    - This table will typically contain a single row with company information
    - All fields are optional to allow gradual setup
*/

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text DEFAULT '',
  logo_url text DEFAULT '',
  address_line1 text DEFAULT '',
  address_line2 text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  zip_code text DEFAULT '',
  country text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  bank_name text DEFAULT '',
  account_number text DEFAULT '',
  routing_number text DEFAULT '',
  account_holder_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read company settings"
  ON company_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update company settings"
  ON company_settings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can insert company settings"
  ON company_settings
  FOR INSERT
  WITH CHECK (true);

-- Insert a default empty row for initial setup
INSERT INTO company_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;