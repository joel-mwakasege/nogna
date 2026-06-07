/*
  # Add Body Background and Border Color Theme Settings

  1. Changes to `system_theme_settings` table
    - Add `theme_body_bg_color` column to control the main body background color (default: #f3f4f6)
    - Add `theme_border_color` column to control card and element borders (default: #e5e7eb)
  
  2. Changes to `company_settings` table
    - Add `theme_body_bg_color` column to control the main body background color (default: #f3f4f6)
    - Add `theme_border_color` column to control card and element borders (default: #e5e7eb)
  
  3. Notes
    - Body background color provides control over the main page background
    - Border color allows customization of card borders and dividers
    - Default values use standard gray tones for a clean, professional appearance
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_theme_settings' AND column_name = 'theme_body_bg_color'
  ) THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_body_bg_color text DEFAULT '#f3f4f6';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_theme_settings' AND column_name = 'theme_border_color'
  ) THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_border_color text DEFAULT '#e5e7eb';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'theme_body_bg_color'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN theme_body_bg_color text DEFAULT '#f3f4f6';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'theme_border_color'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN theme_border_color text DEFAULT '#e5e7eb';
  END IF;
END $$;

UPDATE system_theme_settings SET theme_body_bg_color = '#f3f4f6' WHERE theme_body_bg_color IS NULL;
UPDATE system_theme_settings SET theme_border_color = '#e5e7eb' WHERE theme_border_color IS NULL;
UPDATE company_settings SET theme_body_bg_color = '#f3f4f6' WHERE theme_body_bg_color IS NULL;
UPDATE company_settings SET theme_border_color = '#e5e7eb' WHERE theme_border_color IS NULL;