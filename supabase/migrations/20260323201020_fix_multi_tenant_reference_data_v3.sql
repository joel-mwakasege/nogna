/*
  # Fix Multi-Tenant Reference Data for Currencies and Categories

  1. Changes
    - Add company_id to expense_categories table
    - Add company_id to payment_categories table
    - Add company_id to currencies table (replacing user_id)
    - Delete all existing global default data without company_id
    - Update RLS policies to filter by company_id instead of user_id
    - Update indexes for better performance with company_id filtering

  2. Security
    - Ensure all reference data is scoped to specific companies
    - Update RLS policies to enforce company isolation
    - Only company admins can manage their company's reference data

  3. Important Notes
    - Removes all pre-seeded global data
    - Each company must set up their own currencies and categories
    - This ensures true multi-tenant data isolation
*/

-- Step 1: Add company_id to expense_categories if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_categories' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE expense_categories ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_expense_categories_company_id ON expense_categories(company_id);
  END IF;
END $$;

-- Step 2: Add company_id to payment_categories if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_categories' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE payment_categories ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_payment_categories_company_id ON payment_categories(company_id);
  END IF;
END $$;

-- Step 3: Drop old RLS policies on currencies that depend on user_id
DROP POLICY IF EXISTS "Users can view their own currencies" ON currencies;
DROP POLICY IF EXISTS "Users can insert their own currencies" ON currencies;
DROP POLICY IF EXISTS "Users can update their own currencies" ON currencies;
DROP POLICY IF EXISTS "Users can delete their own currencies" ON currencies;

-- Step 4: Replace user_id with company_id in currencies table
DO $$
BEGIN
  -- Check if user_id column exists and company_id doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'currencies' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'currencies' AND column_name = 'company_id'
  ) THEN
    -- Add company_id column
    ALTER TABLE currencies ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    
    -- Migrate data from user_id to company_id by looking up user's company
    UPDATE currencies 
    SET company_id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE user_profiles.id = currencies.user_id
    )
    WHERE user_id IS NOT NULL;
    
    -- Drop the old user_id column (CASCADE will drop dependent objects)
    ALTER TABLE currencies DROP COLUMN user_id CASCADE;
    
    -- Create index for company_id
    CREATE INDEX IF NOT EXISTS idx_currencies_company_id ON currencies(company_id);
    
    -- Drop old indexes on user_id if they exist
    DROP INDEX IF EXISTS idx_currencies_user_id;
  END IF;
END $$;

-- Step 5: Remove all existing global default data (data without company_id)
DELETE FROM expense_categories WHERE company_id IS NULL;
DELETE FROM payment_categories WHERE company_id IS NULL;
DELETE FROM currencies WHERE company_id IS NULL;

-- Step 6: Update RLS policies for expense_categories
DROP POLICY IF EXISTS "Authenticated users can view expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Users can view company expense categories" ON expense_categories;
CREATE POLICY "Users can view company expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

DROP POLICY IF EXISTS "Only admins can insert expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Admins can insert company expense categories" ON expense_categories;
CREATE POLICY "Admins can insert company expense categories"
  ON expense_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND user_profiles.company_id = expense_categories.company_id
    )
  );

DROP POLICY IF EXISTS "Only admins can update expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Admins can update company expense categories" ON expense_categories;
CREATE POLICY "Admins can update company expense categories"
  ON expense_categories FOR UPDATE
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

DROP POLICY IF EXISTS "Only admins can delete expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Admins can delete company expense categories" ON expense_categories;
CREATE POLICY "Admins can delete company expense categories"
  ON expense_categories FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Step 7: Update RLS policies for payment_categories
DROP POLICY IF EXISTS "Authenticated users can view payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Users can view company payment categories" ON payment_categories;
CREATE POLICY "Users can view company payment categories"
  ON payment_categories FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

DROP POLICY IF EXISTS "Only admins can insert payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Admins can insert company payment categories" ON payment_categories;
CREATE POLICY "Admins can insert company payment categories"
  ON payment_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND user_profiles.company_id = payment_categories.company_id
    )
  );

DROP POLICY IF EXISTS "Only admins can update payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Admins can update company payment categories" ON payment_categories;
CREATE POLICY "Admins can update company payment categories"
  ON payment_categories FOR UPDATE
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

DROP POLICY IF EXISTS "Only admins can delete payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Admins can delete company payment categories" ON payment_categories;
CREATE POLICY "Admins can delete company payment categories"
  ON payment_categories FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Step 8: Create new RLS policies for currencies with company_id
DROP POLICY IF EXISTS "Users can view company currencies" ON currencies;
CREATE POLICY "Users can view company currencies"
  ON currencies FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert company currencies" ON currencies;
CREATE POLICY "Admins can insert company currencies"
  ON currencies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
      AND user_profiles.company_id = currencies.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update company currencies" ON currencies;
CREATE POLICY "Admins can update company currencies"
  ON currencies FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can delete company currencies" ON currencies;
CREATE POLICY "Admins can delete company currencies"
  ON currencies FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );
