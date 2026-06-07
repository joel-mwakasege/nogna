/*
  # Add Card Color to Theme Settings

  1. Changes to Tables
    - Add `theme_card_color` to `system_theme_settings` table
    - Add `theme_card_color` to `company_settings` table
  
  2. Notes
    - Card color will be used for all card backgrounds in the application
    - Default value is white (#FFFFFF) for clean, standard appearance
    - This allows customization of card backgrounds to match brand identity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_theme_settings' AND column_name = 'theme_card_color'
  ) THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_card_color text DEFAULT '#FFFFFF';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'theme_card_color'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN theme_card_color text DEFAULT '#FFFFFF';
  END IF;
END $$;

UPDATE system_theme_settings SET theme_card_color = '#FFFFFF' WHERE theme_card_color IS NULL;
UPDATE company_settings SET theme_card_color = '#FFFFFF' WHERE theme_card_color IS NULL;