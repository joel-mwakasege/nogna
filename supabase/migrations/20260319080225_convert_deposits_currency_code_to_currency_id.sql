/*
  # Convert deposits currency_code to currency_id

  1. Changes
    - Add currency_id column to deposits table (uuid reference to currencies.id)
    - Migrate existing data from currency_code to currency_id
    - Drop currency_code column
    - Add foreign key constraint

  2. Important Notes
    - This migration ensures consistency with expenses table which uses currency_id
    - All existing deposits will be migrated to use currency_id
    - No data loss - existing currency codes are converted to currency IDs
*/

-- Add new currency_id column
ALTER TABLE deposits 
ADD COLUMN IF NOT EXISTS currency_id uuid REFERENCES currencies(id);

-- Migrate existing data from currency_code to currency_id
UPDATE deposits 
SET currency_id = currencies.id
FROM currencies
WHERE deposits.currency_code = currencies.code
AND deposits.currency_id IS NULL;

-- Drop the old currency_code column
ALTER TABLE deposits 
DROP COLUMN IF EXISTS currency_code;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_deposits_currency_id ON deposits(currency_id);

-- Add comment for documentation
COMMENT ON COLUMN deposits.currency_id IS 'Reference to the currency for this deposit';
