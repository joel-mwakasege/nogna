/*
  # Optimize Key RLS Policies for Performance

  1. Performance Improvements
    - Replace `auth.uid()` with `(select auth.uid())` in RLS policies
    - This prevents re-evaluation of auth functions for each row
    - Focus on most frequently accessed tables with company_id column

  2. Tables Optimized
    - expenses (3 admin policies)
    - accounts (3 admin policies)
    - documents (3 admin policies)
    - customers (3 admin policies)
    - deposits (3 admin policies)

  3. Security
    - No security changes, only performance optimization
    - All policies maintain the same access control logic
*/

-- ============================================
-- EXPENSES
-- ============================================

DROP POLICY IF EXISTS "Admins can create expenses" ON public.expenses;
CREATE POLICY "Admins can create expenses"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = expenses.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can update expenses" ON public.expenses;
CREATE POLICY "Admins can update expenses"
ON public.expenses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = expenses.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Users can view expenses" ON public.expenses;
CREATE POLICY "Users can view expenses"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  expenses.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = expenses.company_id
  )
);

-- ============================================
-- ACCOUNTS
-- ============================================

DROP POLICY IF EXISTS "Admins can insert accounts" ON public.accounts;
CREATE POLICY "Admins can insert accounts"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = accounts.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can update accounts" ON public.accounts;
CREATE POLICY "Admins can update accounts"
ON public.accounts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = accounts.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Users can view accounts" ON public.accounts;
CREATE POLICY "Users can view accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  accounts.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = accounts.company_id
  )
);

-- ============================================
-- DOCUMENTS
-- ============================================

DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
CREATE POLICY "Admins can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = documents.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
CREATE POLICY "Admins can update documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = documents.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Users can view documents" ON public.documents;
CREATE POLICY "Users can view documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  documents.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = documents.company_id
  )
);

-- ============================================
-- CUSTOMERS
-- ============================================

DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
CREATE POLICY "Admins can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = customers.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = customers.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Users can view customers" ON public.customers;
CREATE POLICY "Users can view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  customers.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = customers.company_id
  )
);

-- ============================================
-- DEPOSITS
-- ============================================

DROP POLICY IF EXISTS "Admins can insert deposits" ON public.deposits;
CREATE POLICY "Admins can insert deposits"
ON public.deposits
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = deposits.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can update deposits" ON public.deposits;
CREATE POLICY "Admins can update deposits"
ON public.deposits
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = deposits.company_id
    AND user_profiles.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Users can view deposits" ON public.deposits;
CREATE POLICY "Users can view deposits"
ON public.deposits
FOR SELECT
TO authenticated
USING (
  deposits.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = deposits.company_id
  )
);

-- ============================================
-- CURRENCIES
-- ============================================

DROP POLICY IF EXISTS "Users can view company currencies" ON public.currencies;
CREATE POLICY "Users can view company currencies"
ON public.currencies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = currencies.company_id
  )
);

-- ============================================
-- COMPANIES
-- ============================================

DROP POLICY IF EXISTS "Company owners can view their company" ON public.companies;
CREATE POLICY "Company owners can view their company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = companies.id
    AND user_profiles.role = 'owner'
  )
);

DROP POLICY IF EXISTS "Company owners can update their company" ON public.companies;
CREATE POLICY "Company owners can update their company"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = (select auth.uid())
    AND user_profiles.company_id = companies.id
    AND user_profiles.role = 'owner'
  )
);