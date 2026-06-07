/*
  # Add Header Display Mode to Company Settings

  ## Changes

  1. **Add header_display_mode column**
     - Adds a new column to company_settings to control header display
     - Options: 'text', 'logo', 'both'
     - Default: 'text'
  
  2. **Purpose**
     - Allows users to choose how their company branding appears in the header
     - Can show company name only, logo only, or both
*/

-- Add header_display_mode column to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'header_display_mode'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN header_display_mode text DEFAULT 'text' CHECK (header_display_mode IN ('text', 'logo', 'both'));
  END IF;
END $$;