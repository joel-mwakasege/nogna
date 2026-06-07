/*
  # Add Remarks Column to Line Items

  1. Changes
    - Add `remarks` column to `document_line_items` table
      - Type: text
      - Default: empty string
      - Allows storing remarks/notes for each line item
  
  2. Notes
    - This allows adding explanatory notes per line item (e.g., "Complimentary", "Optional", etc.)
    - Uses IF NOT EXISTS pattern to prevent errors if column already exists
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_line_items' AND column_name = 'remarks'
  ) THEN
    ALTER TABLE document_line_items ADD COLUMN remarks text DEFAULT '';
  END IF;
END $$;