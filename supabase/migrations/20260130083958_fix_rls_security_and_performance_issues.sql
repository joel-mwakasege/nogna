/*
  # Fix RLS Security and Performance Issues

  ## Changes Made

  1. **Remove Insecure Policies**
     - Drop all policies with USING (true) or WITH CHECK (true) that bypass RLS
     - Remove "Allow all operations" policies from all tables

  2. **Optimize Auth Function Calls**
     - Replace `auth.uid()` with `(select auth.uid())` in all policies
     - Replace `is_admin(auth.uid())` with `(select is_admin(auth.uid()))` in all policies
     - This prevents re-evaluation for each row and improves performance

  3. **Remove Duplicate Policies**
     - Clean up overlapping permissive policies
     - Keep only the user-specific and admin policies

  4. **Fix Function Search Paths**
     - Update functions with mutable search paths to be immutable

  5. **Security Improvements**
     - Ensure all tables have proper restrictive RLS
     - No data should be accessible without proper authentication
*/

-- ============================================
-- STEP 1: Drop all insecure "Allow all" policies
-- ============================================

DROP POLICY IF EXISTS "Allow all operations on accounts" ON accounts;
DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on document_sections" ON document_sections;
DROP POLICY IF EXISTS "Allow all operations on document_line_items" ON document_line_items;
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;

-- Drop other overly permissive policies
DROP POLICY IF EXISTS "Allow all to delete client custom fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Allow all to insert client custom fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Allow all to update client custom fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Allow all to view client custom fields" ON client_custom_fields;

DROP POLICY IF EXISTS "Users can delete client details" ON client_details;
DROP POLICY IF EXISTS "Users can insert client details" ON client_details;
DROP POLICY IF EXISTS "Users can update client details" ON client_details;
DROP POLICY IF EXISTS "Users can view client details" ON client_details;

DROP POLICY IF EXISTS "Anyone can delete company custom fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Anyone can insert company custom fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Anyone can update company custom fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Anyone can read company custom fields" ON company_custom_fields;

DROP POLICY IF EXISTS "Anyone can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Anyone can update company settings" ON company_settings;
DROP POLICY IF EXISTS "Anyone can read company settings" ON company_settings;

DROP POLICY IF EXISTS "Users can delete custom line items" ON custom_line_items;
DROP POLICY IF EXISTS "Users can insert custom line items" ON custom_line_items;
DROP POLICY IF EXISTS "Users can update custom line items" ON custom_line_items;
DROP POLICY IF EXISTS "Users can view custom line items" ON custom_line_items;

DROP POLICY IF EXISTS "Users can delete document client fields" ON document_client_fields;
DROP POLICY IF EXISTS "Users can insert document client fields" ON document_client_fields;
DROP POLICY IF EXISTS "Users can update document client fields" ON document_client_fields;
DROP POLICY IF EXISTS "Users can view document client fields" ON document_client_fields;

DROP POLICY IF EXISTS "System can insert profiles" ON user_profiles;

-- ============================================
-- STEP 2: Recreate all policies with optimized auth calls
-- ============================================

-- CUSTOMERS table
DROP POLICY IF EXISTS "Users can view own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON customers;
DROP POLICY IF EXISTS "Users can update own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
DROP POLICY IF EXISTS "Admins can insert all customers" ON customers;
DROP POLICY IF EXISTS "Admins can update all customers" ON customers;
DROP POLICY IF EXISTS "Admins can delete all customers" ON customers;

CREATE POLICY "Users can view own customers"
  ON customers FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own customers"
  ON customers FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own customers"
  ON customers FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING ((select is_admin(auth.uid())));

CREATE POLICY "Admins can insert all customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Admins can update all customers"
  ON customers FOR UPDATE
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Admins can delete all customers"
  ON customers FOR DELETE
  TO authenticated
  USING ((select is_admin(auth.uid())));

-- DOCUMENTS table
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "Admins can insert all documents" ON documents;
DROP POLICY IF EXISTS "Admins can update all documents" ON documents;
DROP POLICY IF EXISTS "Admins can delete all documents" ON documents;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  TO authenticated
  USING ((select is_admin(auth.uid())));

CREATE POLICY "Admins can insert all documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Admins can update all documents"
  ON documents FOR UPDATE
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Admins can delete all documents"
  ON documents FOR DELETE
  TO authenticated
  USING ((select is_admin(auth.uid())));

-- DOCUMENT_SECTIONS table
DROP POLICY IF EXISTS "Users can view own document_sections" ON document_sections;
DROP POLICY IF EXISTS "Users can insert own document_sections" ON document_sections;
DROP POLICY IF EXISTS "Users can update own document_sections" ON document_sections;
DROP POLICY IF EXISTS "Users can delete own document_sections" ON document_sections;

CREATE POLICY "Users can view own document_sections"
  ON document_sections FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own document_sections"
  ON document_sections FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own document_sections"
  ON document_sections FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own document_sections"
  ON document_sections FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage all document_sections"
  ON document_sections FOR ALL
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- DOCUMENT_LINE_ITEMS table
DROP POLICY IF EXISTS "Users can view own document_line_items" ON document_line_items;
DROP POLICY IF EXISTS "Users can insert own document_line_items" ON document_line_items;
DROP POLICY IF EXISTS "Users can update own document_line_items" ON document_line_items;
DROP POLICY IF EXISTS "Users can delete own document_line_items" ON document_line_items;

CREATE POLICY "Users can view own document_line_items"
  ON document_line_items FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own document_line_items"
  ON document_line_items FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own document_line_items"
  ON document_line_items FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own document_line_items"
  ON document_line_items FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage all document_line_items"
  ON document_line_items FOR ALL
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- ACCOUNTS table
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can view all accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can insert all accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can update all accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can delete all accounts" ON accounts;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING ((select is_admin(auth.uid())));

CREATE POLICY "Admins can insert all accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Admins can update all accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Admins can delete all accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING ((select is_admin(auth.uid())));

-- PAYMENTS table
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Admins can insert all payments" ON payments;
DROP POLICY IF EXISTS "Admins can update all payments" ON payments;
DROP POLICY IF EXISTS "Admins can delete all payments" ON payments;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own payments"
  ON payments FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING ((select is_admin(auth.uid())));

CREATE POLICY "Admins can insert all payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Admins can update all payments"
  ON payments FOR UPDATE
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Admins can delete all payments"
  ON payments FOR DELETE
  TO authenticated
  USING ((select is_admin(auth.uid())));

-- CUSTOM_LINE_ITEMS table
DROP POLICY IF EXISTS "Users can view own custom_line_items" ON custom_line_items;
DROP POLICY IF EXISTS "Users can insert own custom_line_items" ON custom_line_items;
DROP POLICY IF EXISTS "Users can update own custom_line_items" ON custom_line_items;
DROP POLICY IF EXISTS "Users can delete own custom_line_items" ON custom_line_items;

CREATE POLICY "Users can view own custom_line_items"
  ON custom_line_items FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own custom_line_items"
  ON custom_line_items FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own custom_line_items"
  ON custom_line_items FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own custom_line_items"
  ON custom_line_items FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage all custom_line_items"
  ON custom_line_items FOR ALL
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- CLIENT_DETAILS table
DROP POLICY IF EXISTS "Users can view own client_details" ON client_details;
DROP POLICY IF EXISTS "Users can insert own client_details" ON client_details;
DROP POLICY IF EXISTS "Users can update own client_details" ON client_details;
DROP POLICY IF EXISTS "Users can delete own client_details" ON client_details;

CREATE POLICY "Users can view own client_details"
  ON client_details FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own client_details"
  ON client_details FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own client_details"
  ON client_details FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own client_details"
  ON client_details FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage all client_details"
  ON client_details FOR ALL
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- DOCUMENT_CLIENT_FIELDS table
DROP POLICY IF EXISTS "Users can view own document_client_fields" ON document_client_fields;
DROP POLICY IF EXISTS "Users can insert own document_client_fields" ON document_client_fields;
DROP POLICY IF EXISTS "Users can update own document_client_fields" ON document_client_fields;
DROP POLICY IF EXISTS "Users can delete own document_client_fields" ON document_client_fields;

CREATE POLICY "Users can view own document_client_fields"
  ON document_client_fields FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own document_client_fields"
  ON document_client_fields FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own document_client_fields"
  ON document_client_fields FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own document_client_fields"
  ON document_client_fields FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage all document_client_fields"
  ON document_client_fields FOR ALL
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- CLIENT_CUSTOM_FIELDS table
DROP POLICY IF EXISTS "Users can view own client_custom_fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can insert own client_custom_fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can update own client_custom_fields" ON client_custom_fields;
DROP POLICY IF EXISTS "Users can delete own client_custom_fields" ON client_custom_fields;

CREATE POLICY "Users can view own client_custom_fields"
  ON client_custom_fields FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own client_custom_fields"
  ON client_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own client_custom_fields"
  ON client_custom_fields FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own client_custom_fields"
  ON client_custom_fields FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage all client_custom_fields"
  ON client_custom_fields FOR ALL
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- COMPANY_SETTINGS table
DROP POLICY IF EXISTS "Users can view own company_settings" ON company_settings;
DROP POLICY IF EXISTS "Users can insert own company_settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update own company_settings" ON company_settings;
DROP POLICY IF EXISTS "Users can delete own company_settings" ON company_settings;

CREATE POLICY "Users can view own company_settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own company_settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own company_settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own company_settings"
  ON company_settings FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage all company_settings"
  ON company_settings FOR ALL
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- COMPANY_CUSTOM_FIELDS table
DROP POLICY IF EXISTS "Users can view own company_custom_fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Users can insert own company_custom_fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Users can update own company_custom_fields" ON company_custom_fields;
DROP POLICY IF EXISTS "Users can delete own company_custom_fields" ON company_custom_fields;

CREATE POLICY "Users can view own company_custom_fields"
  ON company_custom_fields FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own company_custom_fields"
  ON company_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own company_custom_fields"
  ON company_custom_fields FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own company_custom_fields"
  ON company_custom_fields FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage all company_custom_fields"
  ON company_custom_fields FOR ALL
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- USER_PROFILES table
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((select is_admin(auth.uid())));

CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

-- EXPENSE_CATEGORIES table
DROP POLICY IF EXISTS "Only admins can insert expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Only admins can update expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Only admins can delete expense categories" ON expense_categories;

CREATE POLICY "Only admins can insert expense categories"
  ON expense_categories FOR INSERT
  TO authenticated
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Only admins can update expense categories"
  ON expense_categories FOR UPDATE
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Only admins can delete expense categories"
  ON expense_categories FOR DELETE
  TO authenticated
  USING ((select is_admin(auth.uid())));

-- PAYMENT_CATEGORIES table
DROP POLICY IF EXISTS "Only admins can insert payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Only admins can update payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Only admins can delete payment categories" ON payment_categories;

CREATE POLICY "Only admins can insert payment categories"
  ON payment_categories FOR INSERT
  TO authenticated
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Only admins can update payment categories"
  ON payment_categories FOR UPDATE
  TO authenticated
  USING ((select is_admin(auth.uid())))
  WITH CHECK ((select is_admin(auth.uid())));

CREATE POLICY "Only admins can delete payment categories"
  ON payment_categories FOR DELETE
  TO authenticated
  USING ((select is_admin(auth.uid())));

-- EXPENSES table
DROP POLICY IF EXISTS "Users can delete their own expenses or admins can delete any" ON expenses;
DROP POLICY IF EXISTS "Users can insert their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;

CREATE POLICY "Users can delete their own expenses or admins can delete any"
  ON expenses FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id OR (select is_admin(auth.uid())));

CREATE POLICY "Users can insert their own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id OR (select is_admin(auth.uid())))
  WITH CHECK ((select auth.uid()) = user_id OR (select is_admin(auth.uid())));

-- ============================================
-- STEP 3: Fix function search paths
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN user_role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, is_active)
  VALUES (
    new.id,
    new.email,
    'user',
    true
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_expense_account_deduction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    UPDATE accounts
    SET balance = balance - NEW.amount,
        updated_at = now()
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;