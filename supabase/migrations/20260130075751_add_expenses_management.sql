/*
  # Add Expenses Management System

  1. New Tables
    - `expense_categories`
      - `id` (uuid, primary key)
      - `name` (text, category name)
      - `description` (text, optional description)
      - `color` (text, hex color for UI display)
      - `is_active` (boolean, whether category is active)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `payment_categories`
      - `id` (uuid, primary key)
      - `name` (text, payment method name e.g., Cash, Credit Card, Bank Transfer)
      - `description` (text, optional description)
      - `is_active` (boolean, whether category is active)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `expenses`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `expense_category_id` (uuid, references expense_categories)
      - `payment_category_id` (uuid, references payment_categories)
      - `amount` (decimal, expense amount)
      - `description` (text, expense description)
      - `expense_date` (date, when expense occurred)
      - `receipt_url` (text, optional receipt attachment)
      - `notes` (text, additional notes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Authenticated users can read all categories
    - Only admins can create/update/delete categories
    - Users can create their own expenses
    - Users can read all expenses
    - Users can update/delete only their own expenses
    - Admins can manage all expenses
*/

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#3B82F6',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payment_categories table
CREATE TABLE IF NOT EXISTS payment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  expense_category_id uuid NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  payment_category_id uuid NOT NULL REFERENCES payment_categories(id) ON DELETE RESTRICT,
  amount decimal(12, 2) NOT NULL,
  description text NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "Authenticated users can view expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert expense categories"
  ON expense_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update expense categories"
  ON expense_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete expense categories"
  ON expense_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for payment_categories
CREATE POLICY "Authenticated users can view payment categories"
  ON payment_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert payment categories"
  ON payment_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update payment categories"
  ON payment_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete payment categories"
  ON payment_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for expenses
CREATE POLICY "Authenticated users can view all expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete their own expenses or admins can delete any"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default expense categories
INSERT INTO expense_categories (name, description, color) VALUES
  ('Office Supplies', 'Pens, paper, and other office materials', '#3B82F6'),
  ('Travel', 'Business travel expenses', '#10B981'),
  ('Meals & Entertainment', 'Client meetings and team meals', '#F59E0B'),
  ('Equipment', 'Computers, furniture, and equipment', '#8B5CF6'),
  ('Utilities', 'Internet, electricity, and other utilities', '#EF4444'),
  ('Marketing', 'Advertising and promotional expenses', '#EC4899'),
  ('Software & Subscriptions', 'Software licenses and subscriptions', '#06B6D4'),
  ('Miscellaneous', 'Other business expenses', '#6B7280')
ON CONFLICT DO NOTHING;

-- Insert default payment categories
INSERT INTO payment_categories (name, description) VALUES
  ('Cash', 'Cash payments'),
  ('Credit Card', 'Credit card payments'),
  ('Debit Card', 'Debit card payments'),
  ('Bank Transfer', 'Direct bank transfers'),
  ('Check', 'Check payments'),
  ('Mobile Payment', 'Mobile payment apps')
ON CONFLICT DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_category_id ON expenses(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_category_id ON expenses(payment_category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
