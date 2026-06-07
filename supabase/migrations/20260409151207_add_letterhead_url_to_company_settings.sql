/*
  # Add Letterhead URL to Company Settings

  ## Summary
  Adds a `letterhead_url` column to the `company_settings` table to store
  a custom letterhead image that appears at the top of invoice/document exports.

  ## Changes
  - `company_settings` table: new `letterhead_url` text column (nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'letterhead_url'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN letterhead_url text DEFAULT NULL;
  END IF;
END $$;
