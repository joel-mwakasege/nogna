/*
  # Add Document Numbering Mode to Company Settings

  1. Changes
    - Add `document_numbering_mode` column to `company_settings` table
      - Type: text with check constraint for 'auto' or 'manual'
      - Default: 'manual' (to maintain current behavior)
    - Add `document_number_prefix` column to store prefix for auto-generated numbers
      - Default: 'DOC-'
    - Add `document_number_counter` column to track next auto-generated number
      - Default: 1

  2. Notes
    - The default is 'manual' to preserve existing behavior
    - When set to 'auto', document numbers will be generated as: prefix + counter
    - Counter automatically increments with each new document
*/

-- Add document numbering mode column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'document_numbering_mode'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN document_numbering_mode text DEFAULT 'manual' CHECK (document_numbering_mode IN ('auto', 'manual'));
  END IF;
END $$;

-- Add document number prefix column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'document_number_prefix'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN document_number_prefix text DEFAULT 'DOC-';
  END IF;
END $$;

-- Add document number counter column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'document_number_counter'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN document_number_counter integer DEFAULT 1;
  END IF;
END $$;