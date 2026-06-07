/*
  # Add default_terms to company_settings

  ## Summary
  Adds a `default_terms` column to the `company_settings` table so that
  administrators can configure the default terms text that appears on all
  newly created billing documents.

  ## Changes
  ### Modified Tables
  - `company_settings`
    - `default_terms` (text, nullable) — stores the default terms/notes text
      that will be pre-filled on new documents instead of the hardcoded string.

  ## Notes
  - Existing documents are not affected; only new documents will pick up the
    default from this column.
  - The column is nullable so that companies with no default terms can leave
    it empty.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'default_terms'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN default_terms text;
  END IF;
END $$;
