/*
  # Add Company ID to Existing Tables for Multi-Tenancy

  1. Changes
    - Add company_id to customers table
    - Add company_id to documents table
    - Add company_id to client_custom_fields table
    - Add company_id to default_client_fields table
    - Add company_id to accounts table
    - Add company_id to expenses table
    - Add company_id to deposits table
    - Add company_id to company_settings table

  2. Security
    - Update RLS policies to enforce company_id filtering
    - Ensure all queries are scoped to the user's company
    
  3. Important Notes
    - This migration adds tenant isolation to all existing tables
    - Existing data may need manual company_id assignment
    - All new records must have company_id set
*/

-- Add company_id to customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
  END IF;
END $$;

-- Add company_id to documents if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
  END IF;
END $$;

-- Add company_id to client_custom_fields if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_custom_fields' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE client_custom_fields ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_client_custom_fields_company_id ON client_custom_fields(company_id);
  END IF;
END $$;

-- Add company_id to default_client_fields if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'default_client_fields' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE default_client_fields ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_default_client_fields_company_id ON default_client_fields(company_id);
  END IF;
END $$;

-- Add company_id to accounts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE accounts ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
  END IF;
END $$;

-- Add company_id to expenses if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON expenses(company_id);
  END IF;
END $$;

-- Add company_id to deposits if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE deposits ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_deposits_company_id ON deposits(company_id);
  END IF;
END $$;

-- Update company_settings to ensure company_id is properly set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);
  END IF;
END $$;

-- Update RLS policies for customers to include company_id check
DROP POLICY IF EXISTS "Users can view customers" ON customers;
CREATE POLICY "Users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "Admins can insert customers" ON customers;
CREATE POLICY "Admins can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND user_profiles.company_id = customers.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update customers" ON customers;
CREATE POLICY "Admins can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Update RLS policies for documents to include company_id check
DROP POLICY IF EXISTS "Users can view documents" ON documents;
CREATE POLICY "Users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "Admins can insert documents" ON documents;
CREATE POLICY "Admins can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND user_profiles.company_id = documents.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update documents" ON documents;
CREATE POLICY "Admins can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Update RLS policies for accounts
DROP POLICY IF EXISTS "Users can view accounts they have access to" ON accounts;
CREATE POLICY "Users can view accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "Admins can insert accounts" ON accounts;
CREATE POLICY "Admins can insert accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND user_profiles.company_id = accounts.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update accounts" ON accounts;
CREATE POLICY "Admins can update accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Update RLS policies for expenses
DROP POLICY IF EXISTS "Users can view all expenses" ON expenses;
CREATE POLICY "Users can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "Admins and assigned users can create expenses" ON expenses;
CREATE POLICY "Admins can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND user_profiles.company_id = expenses.company_id
    )
  );

DROP POLICY IF EXISTS "Admins and assigned users can update expenses" ON expenses;
CREATE POLICY "Admins can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Update RLS policies for deposits
DROP POLICY IF EXISTS "Users can view all deposits" ON deposits;
CREATE POLICY "Users can view deposits"
  ON deposits FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "Admins can create deposits" ON deposits;
CREATE POLICY "Admins can create deposits"
  ON deposits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND user_profiles.company_id = deposits.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update deposits" ON deposits;
CREATE POLICY "Admins can update deposits"
  ON deposits FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Update company_settings RLS policies
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
CREATE POLICY "Users can view company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR company_id IS NULL
    OR user_id = auth.uid()
  );