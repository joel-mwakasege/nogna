/*
  # Add Administrative Notes to Documents

  1. Changes
    - Add `administrative_notes` column to `documents` table
    - This field will store custom notes/instructions for each document
    - Can be used for banking details, payment instructions, or any custom text

  2. Notes
    - Default text can be customized per document
    - Displays at the bottom of invoices/quotes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'administrative_notes'
  ) THEN
    ALTER TABLE documents ADD COLUMN administrative_notes text DEFAULT 'This billing document is generated for internal auditing and client review. All figures are manual entries as per contract agreement. Please verify all line items before final PDF export.';
  END IF;
END $$;