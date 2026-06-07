/*
  # Add Theme Color Customization to Company Settings

  1. Changes
    - Add `theme_primary_color` column to store primary/background color (default: #2596be)
    - Add `theme_text_color` column to store text color (default: #000000)
    - Add `theme_accent_color` column to store accent/button colors (default: #000000)

  2. Security
    - No RLS changes needed - existing policies apply
*/

-- Add theme color columns to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS theme_primary_color text DEFAULT '#2596be',
ADD COLUMN IF NOT EXISTS theme_text_color text DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS theme_accent_color text DEFAULT '#000000';