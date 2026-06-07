/*
  # Add Name Field to User Profiles

  1. Changes
    - Add `name` column to `user_profiles` table
      - Type: `text` (optional/nullable)
      - Purpose: Store user's display name
      - Example: "John Smith", "Jane Doe"
  
  2. Notes
    - Field is optional to maintain backward compatibility
    - Existing users will have NULL names until updated
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'name'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN name text;
  END IF;
END $$;