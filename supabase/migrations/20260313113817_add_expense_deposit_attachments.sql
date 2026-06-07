/*
  # Add File Attachments for Expenses and Deposits

  1. New Tables
    - `expense_attachments`
      - `id` (uuid, primary key)
      - `expense_id` (uuid, foreign key to expenses)
      - `file_name` (text) - Original file name
      - `file_path` (text) - Storage path
      - `file_size` (bigint) - File size in bytes
      - `file_type` (text) - MIME type
      - `uploaded_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `deleted_at` (timestamptz, nullable) - Soft delete support

    - `deposit_attachments`
      - `id` (uuid, primary key)
      - `deposit_id` (uuid, foreign key to deposits)
      - `file_name` (text) - Original file name
      - `file_path` (text) - Storage path
      - `file_size` (bigint) - File size in bytes
      - `file_type` (text) - MIME type
      - `uploaded_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `deleted_at` (timestamptz, nullable) - Soft delete support

  2. Storage
    - Create storage bucket `expense-attachments` for expense files
    - Create storage bucket `deposit-attachments` for deposit files
    - Set up policies for authenticated users to upload and view files

  3. Security
    - Enable RLS on both attachment tables
    - Add policies for authenticated users to:
      - View their own attachments
      - Upload attachments for their expenses/deposits
      - Delete their own attachments
    - Admin users can view and manage all attachments
*/

-- Create expense_attachments table
CREATE TABLE IF NOT EXISTS expense_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create deposit_attachments table
CREATE TABLE IF NOT EXISTS deposit_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense_id ON expense_attachments(expense_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_attachments_uploaded_by ON expense_attachments(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deposit_attachments_deposit_id ON deposit_attachments(deposit_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deposit_attachments_uploaded_by ON deposit_attachments(uploaded_by) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE expense_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_attachments ENABLE ROW LEVEL SECURITY;

-- Expense attachments policies
CREATE POLICY "Users can view attachments for expenses they can view"
  ON expense_attachments FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      uploaded_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
      ) OR
      EXISTS (
        SELECT 1 FROM expenses
        WHERE expenses.id = expense_attachments.expense_id
        AND (expenses.assigned_to_user_id = auth.uid() OR expenses.assigned_to_user_id IS NULL)
      )
    )
  );

CREATE POLICY "Users can upload attachments to their expenses"
  ON expense_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_attachments.expense_id
      AND (expenses.assigned_to_user_id = auth.uid() OR expenses.assigned_to_user_id IS NULL)
    )
  );

CREATE POLICY "Users can delete their own attachments"
  ON expense_attachments FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins can manage all expense attachments"
  ON expense_attachments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Deposit attachments policies
CREATE POLICY "Users can view attachments for deposits they can view"
  ON deposit_attachments FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      uploaded_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
      ) OR
      EXISTS (
        SELECT 1 FROM deposits
        WHERE deposits.id = deposit_attachments.deposit_id
        AND (deposits.assigned_user_id = auth.uid() OR deposits.assigned_user_id IS NULL)
      )
    )
  );

CREATE POLICY "Users can upload attachments to their deposits"
  ON deposit_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM deposits
      WHERE deposits.id = deposit_attachments.deposit_id
      AND (deposits.assigned_user_id = auth.uid() OR deposits.assigned_user_id IS NULL)
    )
  );

CREATE POLICY "Users can delete their own deposit attachments"
  ON deposit_attachments FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins can manage all deposit attachments"
  ON deposit_attachments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-attachments', 'expense-attachments', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('deposit-attachments', 'deposit-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for expense-attachments bucket
CREATE POLICY "Authenticated users can upload expense attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'expense-attachments');

CREATE POLICY "Users can view expense attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'expense-attachments');

CREATE POLICY "Users can update their own expense attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'expense-attachments');

CREATE POLICY "Users can delete their own expense attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'expense-attachments');

-- Storage policies for deposit-attachments bucket
CREATE POLICY "Authenticated users can upload deposit attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'deposit-attachments');

CREATE POLICY "Users can view deposit attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'deposit-attachments');

CREATE POLICY "Users can update their own deposit attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'deposit-attachments');

CREATE POLICY "Users can delete their own deposit attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'deposit-attachments');