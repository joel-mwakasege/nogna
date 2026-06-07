/*
  # Add hide_header to document_sections

  ## Summary
  Adds a boolean column `hide_header` to `document_sections` to support
  the "Remove Section Header Only" option. When true, the section name and
  section total rows are hidden, leaving the line items as a plain unsectioned
  list within the invoice.

  ## Changes
  - `document_sections`: new column `hide_header` (boolean, default false)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_sections' AND column_name = 'hide_header'
  ) THEN
    ALTER TABLE document_sections ADD COLUMN hide_header boolean NOT NULL DEFAULT false;
  END IF;
END $$;
