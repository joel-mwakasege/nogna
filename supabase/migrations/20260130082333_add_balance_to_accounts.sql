/*
  # Add balance column to accounts table

  1. Changes
    - Add `balance` column to accounts table with default value of 0
    - Add `updated_at` column to track when account was last updated
    
  2. Notes
    - Balance will be tracked automatically via triggers when expenses are linked to accounts
    - Existing accounts will start with a balance of 0
*/

-- Add balance column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'balance'
  ) THEN
    ALTER TABLE accounts ADD COLUMN balance numeric(10, 2) DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE accounts ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;