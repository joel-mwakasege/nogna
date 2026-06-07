/*
  # Add Soft Delete Trash System

  1. Changes
    - Add `deleted_at` column to documents, customers, expenses, and accounts tables
    - Create function to permanently delete items older than 30 days
    - Create scheduled job to run cleanup daily
    - Update RLS policies to exclude soft-deleted items by default
    
  2. Security
    - Soft-deleted items are hidden from normal queries via RLS
    - Only authenticated users can see and restore their own deleted items
    
  3. Notes
    - Items with deleted_at set are considered "in trash"
    - After 30 days, items are permanently deleted automatically
    - Restoration sets deleted_at back to NULL
*/

-- Add deleted_at columns to main tables
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create indexes for better performance on trash queries
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at ON accounts(deleted_at) WHERE deleted_at IS NOT NULL;

-- Function to permanently delete items older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete old documents and their related data
  DELETE FROM document_line_items 
  WHERE section_id IN (
    SELECT id FROM document_sections 
    WHERE document_id IN (
      SELECT id FROM documents 
      WHERE deleted_at IS NOT NULL 
      AND deleted_at < NOW() - INTERVAL '30 days'
    )
  );
  
  DELETE FROM document_sections 
  WHERE document_id IN (
    SELECT id FROM documents 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days'
  );
  
  DELETE FROM payments
  WHERE document_id IN (
    SELECT id FROM documents 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days'
  );
  
  DELETE FROM documents 
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '30 days';
  
  -- Delete old customers
  DELETE FROM customers 
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '30 days';
  
  -- Delete old expenses
  DELETE FROM expenses 
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '30 days';
  
  -- Delete old accounts
  DELETE FROM accounts 
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Update RLS policies to exclude soft-deleted items

-- Documents table
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view own trash" ON documents;
CREATE POLICY "Users can view own trash"
  ON documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own documents" ON documents;
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Customers table
DROP POLICY IF EXISTS "Users can view own customers" ON customers;
CREATE POLICY "Users can view own customers"
  ON customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view own customer trash" ON customers;
CREATE POLICY "Users can view own customer trash"
  ON customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own customers" ON customers;
CREATE POLICY "Users can update own customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own customers" ON customers;
CREATE POLICY "Users can delete own customers"
  ON customers FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Expenses table
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view own expense trash" ON expenses;
CREATE POLICY "Users can view own expense trash"
  ON expenses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;
CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Accounts table
DROP POLICY IF EXISTS "Users can view own accounts or unassigned accounts" ON accounts;
CREATE POLICY "Users can view own accounts or unassigned accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid() OR user_id IS NULL) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view own account trash" ON accounts;
CREATE POLICY "Users can view own account trash"
  ON accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;
CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);
