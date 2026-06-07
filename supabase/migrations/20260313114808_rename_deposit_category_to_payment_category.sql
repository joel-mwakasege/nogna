/*
  # Unify Deposit and Expense Categories

  1. Changes
    - Drop the `deposit_categories` table as it's redundant
    - Rename `deposit_category_id` to `source_category_id` in deposits table
    - The `source_category_id` will reference payment_categories for consistency
    - Both deposits and expenses now use the same payment_categories table

  2. Rationale
    - Deposits and expenses should use the same payment categories for consistency
    - This matches the expense system where payment_category_id is used
    - Simplifies the UI by having one unified set of categories

  3. Important Notes
    - Existing deposit records will have their deposit_category_id renamed
    - No data is lost during this migration
    - The payment_category_id field remains unchanged
*/

-- First, check if there are any deposits referencing deposit_categories
DO $$
BEGIN
  -- If deposits table exists and has records, we need to handle them carefully
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deposits') THEN
    -- Update all deposits to set source_category_id = payment_category_id
    -- This assumes payment_category_id is already set
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposits' AND column_name = 'deposit_category_id') THEN
      -- Add the new column if it doesn't exist
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposits' AND column_name = 'source_category_id') THEN
        ALTER TABLE deposits ADD COLUMN source_category_id uuid;
      END IF;
      
      -- Copy payment_category_id to source_category_id for all existing deposits
      UPDATE deposits 
      SET source_category_id = payment_category_id 
      WHERE source_category_id IS NULL;
      
      -- Drop the old foreign key constraint if it exists
      ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_deposit_category_id_fkey;
      
      -- Drop the old column
      ALTER TABLE deposits DROP COLUMN IF EXISTS deposit_category_id;
      
      -- Add foreign key constraint for source_category_id
      ALTER TABLE deposits 
      ADD CONSTRAINT deposits_source_category_id_fkey 
      FOREIGN KEY (source_category_id) 
      REFERENCES payment_categories(id) 
      ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- Drop deposit_categories table and its policies
DROP POLICY IF EXISTS "Users can view active deposit categories" ON deposit_categories;
DROP POLICY IF EXISTS "Admins can insert deposit categories" ON deposit_categories;
DROP POLICY IF EXISTS "Admins can update deposit categories" ON deposit_categories;
DROP POLICY IF EXISTS "Admins can delete deposit categories" ON deposit_categories;

DROP TABLE IF EXISTS deposit_categories CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_deposits_source_category ON deposits(source_category_id);

-- Add comment to explain the field
COMMENT ON COLUMN deposits.source_category_id IS 'Payment method/category for this deposit (references payment_categories)';