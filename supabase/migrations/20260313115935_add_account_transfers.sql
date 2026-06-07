/*
  # Add Account Transfers

  1. New Tables
    - `account_transfers`
      - `id` (uuid, primary key)
      - `from_account_id` (uuid, references accounts)
      - `to_account_id` (uuid, references accounts)
      - `amount` (numeric, must be positive)
      - `currency` (text, currency code)
      - `transfer_date` (date)
      - `description` (text)
      - `notes` (text, nullable)
      - `created_by` (uuid, references auth.users)
      - `deleted_at` (timestamptz, nullable, for soft delete)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `account_transfers` table
    - Add policies for authenticated users to manage their own transfers
    - Admin users can view all transfers

  3. Triggers
    - Add trigger to update account balances when transfer is created
    - Add trigger to reverse account balances when transfer is soft deleted

  4. Important Notes
    - Transfers must be between different accounts
    - Both accounts must use the same currency for the transfer
    - Amount must be positive
    - Automatically updates account_balances for both accounts
*/

-- Create account_transfers table
CREATE TABLE IF NOT EXISTS account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT different_accounts CHECK (from_account_id != to_account_id)
);

-- Enable RLS
ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account_transfers
CREATE POLICY "Users can view their own transfers"
  ON account_transfers
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
      )
    )
  );

CREATE POLICY "Users can create their own transfers"
  ON account_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    deleted_at IS NULL
  );

CREATE POLICY "Users can update their own transfers"
  ON account_transfers
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can soft delete transfers"
  ON account_transfers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Function to handle transfer balance updates
CREATE OR REPLACE FUNCTION handle_transfer_balance_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    -- Deduct from source account
    INSERT INTO account_balances (account_id, currency, balance)
    VALUES (NEW.from_account_id, NEW.currency, -NEW.amount)
    ON CONFLICT (account_id, currency)
    DO UPDATE SET
      balance = account_balances.balance - NEW.amount,
      updated_at = now();

    -- Add to destination account
    INSERT INTO account_balances (account_id, currency, balance)
    VALUES (NEW.to_account_id, NEW.currency, NEW.amount)
    ON CONFLICT (account_id, currency)
    DO UPDATE SET
      balance = account_balances.balance + NEW.amount,
      updated_at = now();

  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Reverse the transfer: add back to source account
    UPDATE account_balances
    SET
      balance = balance + OLD.amount,
      updated_at = now()
    WHERE account_id = OLD.from_account_id AND currency = OLD.currency;

    -- Reverse the transfer: deduct from destination account
    UPDATE account_balances
    SET
      balance = balance - OLD.amount,
      updated_at = now()
    WHERE account_id = OLD.to_account_id AND currency = OLD.currency;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for transfer balance updates
DROP TRIGGER IF EXISTS trigger_transfer_balance_update ON account_transfers;
CREATE TRIGGER trigger_transfer_balance_update
  AFTER INSERT OR UPDATE ON account_transfers
  FOR EACH ROW
  EXECUTE FUNCTION handle_transfer_balance_update();

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_account_transfers_from_account ON account_transfers(from_account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_transfers_to_account ON account_transfers(to_account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_transfers_date ON account_transfers(transfer_date) WHERE deleted_at IS NULL;