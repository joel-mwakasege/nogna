/*
  # Update Default Theme Colors

  1. Changes
    - Update default theme colors to use standard blue palette
    - Primary color: #3b82f6 (blue-500)
    - Text color: #ffffff (white for better contrast)
    - Accent color: #1e40af (blue-800)
    - Updates both system_theme_settings and company_settings defaults
  
  2. Notes
    - Removes hardcoded #2596be color
    - Uses standard Tailwind-style color palette
    - Only updates records that still have the old default value
*/

UPDATE system_theme_settings 
SET 
  theme_primary_color = '#3b82f6',
  theme_text_color = '#ffffff',
  theme_accent_color = '#1e40af'
WHERE 
  theme_primary_color = '#2596be' 
  OR theme_text_color = '#000000';

UPDATE company_settings 
SET 
  theme_primary_color = '#3b82f6',
  theme_text_color = '#ffffff',
  theme_accent_color = '#1e40af'
WHERE 
  theme_primary_color = '#2596be' 
  OR theme_text_color = '#000000';