/*
  # Add Tax Fields to Expenses and Deposits

  1. Changes to `expenses` table
    - Add `amount_excluding_tax` (decimal, base amount before tax)
    - Add `tax_amount` (decimal, tax amount)
    - Add `tax_percentage` (decimal, tax rate percentage for reference)
    - Keep existing `amount` field as total amount (amount_excluding_tax + tax_amount)
  
  2. Changes to `deposits` table
    - Add `amount_excluding_tax` (decimal, base amount before tax)
    - Add `tax_amount` (decimal, tax amount)
    - Add `tax_percentage` (decimal, tax rate percentage for reference)
    - Keep existing `amount` field as total amount (amount_excluding_tax + tax_amount)

  3. Important Notes
    - `amount` field will store the total (including tax) for consistency
    - `amount_excluding_tax` stores the base amount
    - `tax_amount` stores the calculated tax
    - `tax_percentage` stores the tax rate used (e.g., 18 for 18%)
    - All fields are nullable to support records without tax
    - When tax fields are null, `amount` represents the total as before
*/

-- Add tax fields to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS amount_excluding_tax decimal(15, 2),
ADD COLUMN IF NOT EXISTS tax_amount decimal(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_percentage decimal(5, 2);

-- Add tax fields to deposits table
ALTER TABLE deposits 
ADD COLUMN IF NOT EXISTS amount_excluding_tax decimal(15, 2),
ADD COLUMN IF NOT EXISTS tax_amount decimal(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_percentage decimal(5, 2);

-- Add check constraints to ensure data consistency
ALTER TABLE expenses 
DROP CONSTRAINT IF EXISTS expenses_tax_amount_check,
ADD CONSTRAINT expenses_tax_amount_check CHECK (tax_amount >= 0);

ALTER TABLE deposits 
DROP CONSTRAINT IF EXISTS deposits_tax_amount_check,
ADD CONSTRAINT deposits_tax_amount_check CHECK (tax_amount >= 0);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_tax_amount ON expenses(tax_amount) WHERE tax_amount > 0;
CREATE INDEX IF NOT EXISTS idx_deposits_tax_amount ON deposits(tax_amount) WHERE tax_amount > 0;

-- Migrate existing data: set amount_excluding_tax to amount for existing records
UPDATE expenses 
SET amount_excluding_tax = amount, 
    tax_amount = 0
WHERE amount_excluding_tax IS NULL;

UPDATE deposits 
SET amount_excluding_tax = amount,
    tax_amount = 0
WHERE amount_excluding_tax IS NULL;