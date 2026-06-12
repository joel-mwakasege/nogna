-- Alter system_theme_settings defaults to Monochrome / Black & White theme
ALTER TABLE system_theme_settings ALTER COLUMN theme_primary_color SET DEFAULT '#09090b';
ALTER TABLE system_theme_settings ALTER COLUMN theme_text_color SET DEFAULT '#ffffff';
ALTER TABLE system_theme_settings ALTER COLUMN theme_accent_color SET DEFAULT '#18181b';
ALTER TABLE system_theme_settings ALTER COLUMN theme_card_color SET DEFAULT '#ffffff';
ALTER TABLE system_theme_settings ALTER COLUMN theme_body_bg_color SET DEFAULT '#fafafa';
ALTER TABLE system_theme_settings ALTER COLUMN theme_border_color SET DEFAULT '#e4e4e7';
ALTER TABLE system_theme_settings ALTER COLUMN theme_success_color SET DEFAULT '#10b981';
ALTER TABLE system_theme_settings ALTER COLUMN theme_warning_color SET DEFAULT '#f59e0b';
ALTER TABLE system_theme_settings ALTER COLUMN theme_error_color SET DEFAULT '#ef4444';
ALTER TABLE system_theme_settings ALTER COLUMN theme_info_color SET DEFAULT '#18181b';
ALTER TABLE system_theme_settings ALTER COLUMN theme_text_primary SET DEFAULT '#09090b';
ALTER TABLE system_theme_settings ALTER COLUMN theme_text_secondary SET DEFAULT '#71717a';
ALTER TABLE system_theme_settings ALTER COLUMN theme_shadow_enabled SET DEFAULT true;
ALTER TABLE system_theme_settings ALTER COLUMN theme_shadow_intensity SET DEFAULT 'subtle';
ALTER TABLE system_theme_settings ALTER COLUMN theme_font_family SET DEFAULT 'Outfit';

-- Alter company_settings defaults to Monochrome / Black & White theme
ALTER TABLE company_settings ALTER COLUMN theme_primary_color SET DEFAULT '#09090b';
ALTER TABLE company_settings ALTER COLUMN theme_text_color SET DEFAULT '#ffffff';
ALTER TABLE company_settings ALTER COLUMN theme_accent_color SET DEFAULT '#18181b';
ALTER TABLE company_settings ALTER COLUMN theme_card_color SET DEFAULT '#ffffff';
ALTER TABLE company_settings ALTER COLUMN theme_body_bg_color SET DEFAULT '#fafafa';
ALTER TABLE company_settings ALTER COLUMN theme_border_color SET DEFAULT '#e4e4e7';
ALTER TABLE company_settings ALTER COLUMN theme_success_color SET DEFAULT '#10b981';
ALTER TABLE company_settings ALTER COLUMN theme_warning_color SET DEFAULT '#f59e0b';
ALTER TABLE company_settings ALTER COLUMN theme_error_color SET DEFAULT '#ef4444';
ALTER TABLE company_settings ALTER COLUMN theme_info_color SET DEFAULT '#18181b';
ALTER TABLE company_settings ALTER COLUMN theme_text_primary SET DEFAULT '#09090b';
ALTER TABLE company_settings ALTER COLUMN theme_text_secondary SET DEFAULT '#71717a';
ALTER TABLE company_settings ALTER COLUMN theme_shadow_enabled SET DEFAULT true;
ALTER TABLE company_settings ALTER COLUMN theme_shadow_intensity SET DEFAULT 'subtle';
ALTER TABLE company_settings ALTER COLUMN theme_font_family SET DEFAULT 'Outfit';

-- Update or insert system_theme_settings with default monochrome values
INSERT INTO system_theme_settings (
  theme_primary_color, theme_text_color, theme_accent_color, theme_card_color, 
  theme_body_bg_color, theme_border_color, theme_success_color, theme_warning_color, 
  theme_error_color, theme_info_color, theme_text_primary, theme_text_secondary, 
  theme_shadow_enabled, theme_shadow_intensity, theme_font_family
)
VALUES (
  '#09090b', '#ffffff', '#18181b', '#ffffff', 
  '#fafafa', '#e4e4e7', '#10b981', '#f59e0b', 
  '#ef4444', '#18181b', '#09090b', '#71717a', 
  true, 'subtle', 'Outfit'
)
ON CONFLICT DO NOTHING; -- If there's a unique constraint or primary key conflict

-- If system_theme_settings already has rows, force update the first row
UPDATE system_theme_settings 
SET 
  theme_primary_color = '#09090b', 
  theme_text_color = '#ffffff', 
  theme_accent_color = '#18181b', 
  theme_card_color = '#ffffff', 
  theme_body_bg_color = '#fafafa', 
  theme_border_color = '#e4e4e7', 
  theme_success_color = '#10b981', 
  theme_warning_color = '#f59e0b', 
  theme_error_color = '#ef4444', 
  theme_info_color = '#18181b', 
  theme_text_primary = '#09090b', 
  theme_text_secondary = '#71717a', 
  theme_shadow_enabled = true, 
  theme_shadow_intensity = 'subtle', 
  theme_font_family = 'Outfit';

-- Update all existing company settings to the new monochrome default
UPDATE company_settings 
SET 
  theme_primary_color = '#09090b', 
  theme_text_color = '#ffffff', 
  theme_accent_color = '#18181b', 
  theme_card_color = '#ffffff', 
  theme_body_bg_color = '#fafafa', 
  theme_border_color = '#e4e4e7', 
  theme_success_color = '#10b981', 
  theme_warning_color = '#f59e0b', 
  theme_error_color = '#ef4444', 
  theme_info_color = '#18181b', 
  theme_text_primary = '#09090b', 
  theme_text_secondary = '#71717a', 
  theme_shadow_enabled = true, 
  theme_shadow_intensity = 'subtle', 
  theme_font_family = 'Outfit';
