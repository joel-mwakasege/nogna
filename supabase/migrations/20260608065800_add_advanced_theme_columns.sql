-- Migration: Add advanced theme settings for colors and fonts
-- Applies to both `system_theme_settings` and `company_settings` tables

DO $$
BEGIN
  -- theme_text_primary
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_theme_settings' AND column_name = 'theme_text_primary') THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_text_primary text DEFAULT '#111827';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'theme_text_primary') THEN
    ALTER TABLE company_settings ADD COLUMN theme_text_primary text DEFAULT '#111827';
  END IF;

  -- theme_text_secondary
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_theme_settings' AND column_name = 'theme_text_secondary') THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_text_secondary text DEFAULT '#4b5563';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'theme_text_secondary') THEN
    ALTER TABLE company_settings ADD COLUMN theme_text_secondary text DEFAULT '#4b5563';
  END IF;

  -- theme_success_color
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_theme_settings' AND column_name = 'theme_success_color') THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_success_color text DEFAULT '#10b981';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'theme_success_color') THEN
    ALTER TABLE company_settings ADD COLUMN theme_success_color text DEFAULT '#10b981';
  END IF;

  -- theme_warning_color
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_theme_settings' AND column_name = 'theme_warning_color') THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_warning_color text DEFAULT '#f59e0b';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'theme_warning_color') THEN
    ALTER TABLE company_settings ADD COLUMN theme_warning_color text DEFAULT '#f59e0b';
  END IF;

  -- theme_error_color
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_theme_settings' AND column_name = 'theme_error_color') THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_error_color text DEFAULT '#ef4444';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'theme_error_color') THEN
    ALTER TABLE company_settings ADD COLUMN theme_error_color text DEFAULT '#ef4444';
  END IF;

  -- theme_info_color
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_theme_settings' AND column_name = 'theme_info_color') THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_info_color text DEFAULT '#3b82f6';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'theme_info_color') THEN
    ALTER TABLE company_settings ADD COLUMN theme_info_color text DEFAULT '#3b82f6';
  END IF;

  -- theme_font_family
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_theme_settings' AND column_name = 'theme_font_family') THEN
    ALTER TABLE system_theme_settings ADD COLUMN theme_font_family text DEFAULT 'Inter';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'theme_font_family') THEN
    ALTER TABLE company_settings ADD COLUMN theme_font_family text DEFAULT 'Inter';
  END IF;
END $$;

-- Update existing records to ensure defaults are populated
UPDATE system_theme_settings SET 
  theme_text_primary = COALESCE(theme_text_primary, '#111827'),
  theme_text_secondary = COALESCE(theme_text_secondary, '#4b5563'),
  theme_success_color = COALESCE(theme_success_color, '#10b981'),
  theme_warning_color = COALESCE(theme_warning_color, '#f59e0b'),
  theme_error_color = COALESCE(theme_error_color, '#ef4444'),
  theme_info_color = COALESCE(theme_info_color, '#3b82f6'),
  theme_font_family = COALESCE(theme_font_family, 'Inter');

UPDATE company_settings SET 
  theme_text_primary = COALESCE(theme_text_primary, '#111827'),
  theme_text_secondary = COALESCE(theme_text_secondary, '#4b5563'),
  theme_success_color = COALESCE(theme_success_color, '#10b981'),
  theme_warning_color = COALESCE(theme_warning_color, '#f59e0b'),
  theme_error_color = COALESCE(theme_error_color, '#ef4444'),
  theme_info_color = COALESCE(theme_info_color, '#3b82f6'),
  theme_font_family = COALESCE(theme_font_family, 'Inter');
