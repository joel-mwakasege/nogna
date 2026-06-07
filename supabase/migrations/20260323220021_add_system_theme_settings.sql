/*
  # Add System-Wide Theme Settings

  1. New Tables
    - `system_theme_settings`
      - `id` (uuid, primary key)
      - `theme_primary_color` (text) - Primary background color
      - `theme_text_color` (text) - Text color on headers
      - `theme_accent_color` (text) - Accent/secondary color
      - `theme_shadow_enabled` (boolean) - Enable/disable shadows
      - `theme_shadow_intensity` (text) - Shadow intensity level
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `system_theme_settings` table
    - Add policy for superadmins to read system theme settings
    - Add policy for superadmins to update system theme settings
    - Add policy for all authenticated users to read system theme settings
  
  3. Notes
    - System theme settings apply to all companies unless they have custom themes
    - Only superadmins can modify system theme settings
    - This provides a default theme that can be overridden per company
*/

CREATE TABLE IF NOT EXISTS system_theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_primary_color text DEFAULT '#2596be',
  theme_text_color text DEFAULT '#000000',
  theme_accent_color text DEFAULT '#000000',
  theme_shadow_enabled boolean DEFAULT true,
  theme_shadow_intensity text DEFAULT 'medium' CHECK (theme_shadow_intensity IN ('none', 'subtle', 'medium', 'strong')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read system theme"
  ON system_theme_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superadmins can update system theme"
  ON system_theme_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can insert system theme"
  ON system_theme_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
    )
  );

-- Insert default system theme settings if none exist
INSERT INTO system_theme_settings (theme_primary_color, theme_text_color, theme_accent_color, theme_shadow_enabled, theme_shadow_intensity)
SELECT '#2596be', '#000000', '#000000', true, 'medium'
WHERE NOT EXISTS (SELECT 1 FROM system_theme_settings LIMIT 1);