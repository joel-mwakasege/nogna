/*
  # Add Units Multiplier to Document Sections

  1. Changes
    - Add `units_multiplier` column to `document_sections` table
      - Type: `numeric` (default: 1)
      - Purpose: Allows applying a multiplier to section subtotals
      - Example: If section subtotal is $1000 and units_multiplier is 5, total becomes $5000
  
  2. Notes
    - Default value of 1 ensures backward compatibility
    - Non-null to prevent calculation issues
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_sections' AND column_name = 'units_multiplier'
  ) THEN
    ALTER TABLE document_sections 
    ADD COLUMN units_multiplier numeric DEFAULT 1 NOT NULL;
  END IF;
END $$;