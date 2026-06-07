/*
  # Remove Source Category from Deposits

  1. Changes
    - Remove source_category_id column from deposits table
    - Drop related foreign key constraint
    - Remove related index if exists

  2. Important Notes
    - This simplifies the deposit form by removing redundant field
    - Only payment_category_id will be used going forward
    - No data loss for other fields
*/

-- Drop the index on source_category_id if it exists
DROP INDEX IF EXISTS idx_deposits_source_category;

-- Drop the foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deposits_source_category_id_fkey'
    AND table_name = 'deposits'
  ) THEN
    ALTER TABLE deposits DROP CONSTRAINT deposits_source_category_id_fkey;
  END IF;
END $$;

-- Remove the source_category_id column
ALTER TABLE deposits DROP COLUMN IF EXISTS source_category_id;
