/*
  # Remove Currency CHECK Constraints
  
  1. Changes
    - Remove CHECK constraints limiting currency to only USD, GBP, EUR from:
      - documents table
      - accounts table  
      - payments table
    - Add unique constraint to currencies.code column
    - Add foreign key constraints to ensure currency codes are valid
    
  2. Rationale
    - The app has a currencies table supporting multiple currencies including TZS
    - CHECK constraints were preventing document creation with valid currencies
    - Foreign keys provide data integrity while allowing flexibility
    
  3. Notes
    - Currency validation now relies on the currencies table
    - Frontend already loads currencies dynamically
    - No data migration needed as existing values remain valid
*/

-- First, add unique constraint to currencies.code if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'currencies_code_unique'
  ) THEN
    ALTER TABLE currencies 
    ADD CONSTRAINT currencies_code_unique UNIQUE (code);
  END IF;
END $$;

-- Drop CHECK constraint on documents.currency
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'documents_currency_check'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_currency_check;
  END IF;
END $$;

-- Drop CHECK constraint on accounts.currency  
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'accounts_currency_check'
  ) THEN
    ALTER TABLE accounts DROP CONSTRAINT accounts_currency_check;
  END IF;
END $$;

-- Drop CHECK constraint on payments.currency
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_currency_check'
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_currency_check;
  END IF;
END $$;

-- Add foreign key constraint to documents.currency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'documents_currency_fkey'
  ) THEN
    ALTER TABLE documents 
    ADD CONSTRAINT documents_currency_fkey 
    FOREIGN KEY (currency) REFERENCES currencies(code);
  END IF;
END $$;

-- Add foreign key constraint to accounts.currency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'accounts_currency_fkey'
  ) THEN
    ALTER TABLE accounts 
    ADD CONSTRAINT accounts_currency_fkey 
    FOREIGN KEY (currency) REFERENCES currencies(code);
  END IF;
END $$;

-- Add foreign key constraint to payments.currency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_currency_fkey'
  ) THEN
    ALTER TABLE payments 
    ADD CONSTRAINT payments_currency_fkey 
    FOREIGN KEY (currency) REFERENCES currencies(code);
  END IF;
END $$;