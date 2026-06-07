/*
  # Fix Expense and Payment Categories RLS Policies

  1. Problem
    - INSERT policies require company_id to match user's company_id
    - Frontend doesn't pass company_id when creating categories
    - This causes RLS violations when users try to create categories

  2. Solution
    - Update INSERT policies to automatically use user's company_id
    - Remove the requirement for company_id to be passed from frontend
    - Add trigger to automatically set company_id on INSERT if not provided

  3. Changes
    - Drop and recreate INSERT policies for expense_categories
    - Drop and recreate INSERT policies for payment_categories
    - Add trigger to auto-populate company_id from user's profile
*/

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Admins can insert company expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Admins can insert company payment categories" ON payment_categories;

-- Create new INSERT policy for expense_categories that auto-uses user's company_id
CREATE POLICY "Admins can insert company expense categories"
  ON expense_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND (
        expense_categories.company_id = user_profiles.company_id
        OR expense_categories.company_id IS NULL
      )
    )
  );

-- Create new INSERT policy for payment_categories that auto-uses user's company_id
CREATE POLICY "Admins can insert company payment categories"
  ON payment_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND (
        payment_categories.company_id = user_profiles.company_id
        OR payment_categories.company_id IS NULL
      )
    )
  );

-- Create trigger function to auto-populate company_id for expense_categories
CREATE OR REPLACE FUNCTION set_expense_category_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM user_profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to auto-populate company_id for payment_categories
CREATE OR REPLACE FUNCTION set_payment_category_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM user_profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_set_expense_category_company_id ON expense_categories;
DROP TRIGGER IF EXISTS trg_set_payment_category_company_id ON payment_categories;

-- Create triggers to auto-populate company_id
CREATE TRIGGER trg_set_expense_category_company_id
  BEFORE INSERT ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_category_company_id();

CREATE TRIGGER trg_set_payment_category_company_id
  BEFORE INSERT ON payment_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_payment_category_company_id();
