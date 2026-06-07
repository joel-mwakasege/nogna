/*
  # Add Remarks Field to Documents Table

  1. Changes
    - Add `remarks` column to `documents` table
      - `remarks` (text, optional field for explaining totals - e.g., "complimentary", "inclusive", etc.)

  2. Notes
    - This field allows users to add explanatory notes about the document total
    - Field is optional and can contain any text
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'remarks'
  ) THEN
    ALTER TABLE documents ADD COLUMN remarks text DEFAULT '';
  END IF;
END $$;