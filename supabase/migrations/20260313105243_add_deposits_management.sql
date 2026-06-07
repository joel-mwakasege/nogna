/*
  # Add Deposits Management

  1. New Tables
    - `deposit_categories`
      - `id` (uuid, primary key)
      - `name` (text, category name)
      - `color` (text, hex color code for UI)
      - `is_active` (boolean, for soft deactivation)
      - `created_at` (timestamptz)
      - `deleted_at` (timestamptz, for soft delete)
    
    - `deposits`
      - `id` (uuid, primary key)
      - `description` (text, deposit description)
      - `amount` (decimal, deposit amount)
      - `currency_code` (text, currency of the deposit)
      - `deposit_date` (date)
      - `account_id` (uuid, foreign key to accounts)
      - `deposit_category_id` (uuid, foreign key to deposit_categories)
      - `payment_category_id` (uuid, foreign key to payment_categories)
      - `assigned_user_id` (uuid, foreign key to user_profiles)
      - `receipt_url` (text, optional receipt/proof URL)
      - `notes` (text, additional notes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `deleted_at` (timestamptz, for soft delete)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their deposits
    - Users can view all deposits but only admins can create/update/delete

  3. Important Notes
    - Deposits increase account balances (opposite of expenses)
    - Similar structure to expenses for consistency
    - Supports multi-currency deposits
    - Soft delete support for trash functionality
*/

-- Create deposit_categories table
CREATE TABLE IF NOT EXISTS deposit_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#10b981',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create deposits table
CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount decimal(15, 2) NOT NULL CHECK (amount >= 0),
  currency_code text NOT NULL DEFAULT 'USD',
  deposit_date date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  deposit_category_id uuid REFERENCES deposit_categories(id) ON DELETE RESTRICT,
  payment_category_id uuid REFERENCES payment_categories(id) ON DELETE RESTRICT,
  assigned_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  receipt_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Enable RLS
ALTER TABLE deposit_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- Policies for deposit_categories
CREATE POLICY "Users can view active deposit categories"
  ON deposit_categories FOR SELECT
  TO authenticated
  USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "Admins can insert deposit categories"
  ON deposit_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can update deposit categories"
  ON deposit_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can delete deposit categories"
  ON deposit_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

-- Policies for deposits
CREATE POLICY "Users can view non-deleted deposits"
  ON deposits FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Users can view their own deleted deposits in trash"
  ON deposits FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert deposits"
  ON deposits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can update non-deleted deposits"
  ON deposits FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can soft delete deposits"
  ON deposits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can hard delete deposits"
  ON deposits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deposits_account_id ON deposits(account_id);
CREATE INDEX IF NOT EXISTS idx_deposits_deposit_date ON deposits(deposit_date);
CREATE INDEX IF NOT EXISTS idx_deposits_deleted_at ON deposits(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_user ON deposits(assigned_user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deposits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deposits_updated_at
  BEFORE UPDATE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_deposits_updated_at();

-- Insert default deposit categories
INSERT INTO deposit_categories (name, color) VALUES
  ('Client Payment', '#10b981'),
  ('Loan', '#3b82f6'),
  ('Investment Return', '#8b5cf6'),
  ('Refund', '#f59e0b'),
  ('Other Income', '#6366f1')
ON CONFLICT DO NOTHING;