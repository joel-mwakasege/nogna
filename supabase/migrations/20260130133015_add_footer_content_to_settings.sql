/*
  # Add Footer Content to Company Settings

  1. Changes
    - Add `footer_content` column to `company_settings` table
      - `footer_content` (text, default '') - Configurable footer text that appears on all pages

  2. Notes
    - This allows users to configure a global footer that appears consistently across all pages
    - The footer content can include contact info, copyright, or any other information
    - Stored in company_settings since it's a company-wide configuration
*/

-- Add footer_content column to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'footer_content'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN footer_content text DEFAULT '';
  END IF;
END $$;
