/*
  # Add Multi-Currency Support for Accounts

  ## Summary
  This migration enables accounts to hold multiple currencies by creating a new 
  account_balances table that tracks balances per currency for each account.

  ## Changes Made

  1. New Tables
    - `account_balances` - Tracks balance for each currency within an account
      - `id` (uuid, primary key)
      - `account_id` (uuid, foreign key to accounts)
      - `currency` (text, the currency code)
      - `balance` (numeric, the balance in this currency)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modifications
    - Remove single `balance` column from `accounts` table
    - Keep `currency` field as the "primary" or "default" currency for the account

  3. Security
    - Enable RLS on account_balances table
    - Add policies for authenticated users

  4. Important Notes
    - Each account can now hold balances in multiple currencies
    - The currency field in accounts represents the primary/default currency
    - Existing balance data will be migrated to account_balances using the account's currency
*/

-- Create account_balances table
CREATE TABLE IF NOT EXISTS account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  currency text NOT NULL CHECK (currency IN ('USD', 'GBP', 'EUR', 'TZS')),
  balance numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id, currency)
);

-- Migrate existing balance data from accounts to account_balances
INSERT INTO account_balances (account_id, currency, balance)
SELECT id, currency, balance
FROM accounts
WHERE balance IS NOT NULL;

-- Enable RLS on account_balances
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

-- Create policies for account_balances
CREATE POLICY "Users can view all account balances"
  ON account_balances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert account balances"
  ON account_balances FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update account balances"
  ON account_balances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete account balances"
  ON account_balances FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_balances_account_id ON account_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_currency ON account_balances(currency);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_account_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on balance changes
CREATE TRIGGER account_balances_updated_at
  BEFORE UPDATE ON account_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balances_updated_at();

-- Remove balance column from accounts table
ALTER TABLE accounts DROP COLUMN IF EXISTS balance;
