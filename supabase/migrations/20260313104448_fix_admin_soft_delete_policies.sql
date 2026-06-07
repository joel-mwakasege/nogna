/*
  # Fix Admin RLS Policies for Soft Delete

  1. Changes
    - Update admin view policies to exclude soft-deleted items by default
    - Create separate policies for admins to view trash
    - Apply same pattern to all tables (documents, customers, expenses, accounts)
    
  2. Security
    - Admins can see all non-deleted items
    - Admins can see trash items separately
    - Maintains proper separation between active and deleted items
*/

-- Documents policies
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can view all trash" ON documents;
CREATE POLICY "Admins can view all trash"
  ON documents FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) AND deleted_at IS NOT NULL);

-- Customers policies
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can view all customer trash" ON customers;
CREATE POLICY "Admins can view all customer trash"
  ON customers FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) AND deleted_at IS NOT NULL);

-- Expenses policies
DROP POLICY IF EXISTS "Admins can view all expenses" ON expenses;
CREATE POLICY "Admins can view all expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can view all expense trash" ON expenses;
CREATE POLICY "Admins can view all expense trash"
  ON expenses FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) AND deleted_at IS NOT NULL);

-- Accounts policies
DROP POLICY IF EXISTS "Admins can view all accounts" ON accounts;
CREATE POLICY "Admins can view all accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can view all account trash" ON accounts;
CREATE POLICY "Admins can view all account trash"
  ON accounts FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) AND deleted_at IS NOT NULL);
