/*
  # Add Accounts and Payments Tables

  1. New Tables
    - `accounts`
      - `id` (uuid, primary key)
      - `name` (text, account name e.g., "Business Bank Account", "PayPal", "Stripe")
      - `account_type` (text, type of account: bank_account, paypal, stripe, cash, other)
      - `account_number` (text, optional account identifier/last 4 digits)
      - `currency` (text, primary currency for this account)
      - `is_active` (boolean, whether account is currently active)
      - `created_at` (timestamptz, creation timestamp)
    
    - `payments`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to documents)
      - `account_id` (uuid, foreign key to accounts)
      - `amount` (numeric, payment amount)
      - `currency` (text, payment currency)
      - `payment_date` (date, when payment was received)
      - `payment_method` (text, how payment was received)
      - `reference_number` (text, transaction reference/check number)
      - `notes` (text, payment notes/reason)
      - `created_at` (timestamptz, creation timestamp)
      - `created_by` (text, who recorded the payment)

  2. Changes
    - Update documents status constraint to include 'partially_paid'

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated access

  4. Important Notes
    - Payments are tracked separately from document totals
    - Document status should be calculated based on payments vs total
    - Multiple payments can be made against a single document
    - Each payment records which account received the funds
*/

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'bank_account' CHECK (account_type IN ('bank_account', 'paypal', 'stripe', 'cash', 'other')),
  account_number text,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'GBP', 'EUR')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'GBP', 'EUR')),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'credit_card', 'paypal', 'stripe', 'cash', 'check', 'other')),
  reference_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- Update documents table to include 'partially_paid' status
DO $$
BEGIN
  -- Drop the existing constraint
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
  
  -- Add the new constraint with partially_paid
  ALTER TABLE documents ADD CONSTRAINT documents_status_check 
    CHECK (status IN ('draft', 'pending', 'paid', 'partially_paid', 'overdue'));
END $$;

-- Enable RLS on new tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies for accounts table
CREATE POLICY "Allow all operations on accounts"
  ON accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for payments table
CREATE POLICY "Allow all operations on payments"
  ON payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_document_id ON payments(document_id);
CREATE INDEX IF NOT EXISTS idx_payments_account_id ON payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active);

-- Insert some default accounts for common use cases
INSERT INTO accounts (name, account_type, currency, is_active) VALUES
  ('Main Business Account', 'bank_account', 'USD', true),
  ('PayPal Business', 'paypal', 'USD', true),
  ('Stripe Account', 'stripe', 'USD', true)
ON CONFLICT DO NOTHING;
