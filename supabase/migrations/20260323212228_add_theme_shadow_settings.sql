/*
  # Add Theme Shadow Settings

  1. Changes
    - Add `theme_shadow_enabled` boolean column to company_settings
    - Add `theme_shadow_intensity` text column to company_settings (values: 'none', 'subtle', 'medium', 'strong')
  
  2. Notes
    - Shadow enabled defaults to true for existing visual consistency
    - Shadow intensity defaults to 'medium' for balanced appearance
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'theme_shadow_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN theme_shadow_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'theme_shadow_intensity'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN theme_shadow_intensity text DEFAULT 'medium' CHECK (theme_shadow_intensity IN ('none', 'subtle', 'medium', 'strong'));
  END IF;
END $$;