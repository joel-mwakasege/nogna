/*
  # Add Currency Support to Expenses

  1. Changes
    - Add `currency_id` column to `expenses` table
      - References `currencies` table
      - Required field with foreign key constraint
    - Add index on `currency_id` for performance
    
  2. Notes
    - Existing expenses will need a default currency
    - Users should select currency when creating expenses
*/

-- Add currency_id column to expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN currency_id uuid REFERENCES currencies(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_currency_id ON expenses(currency_id);
