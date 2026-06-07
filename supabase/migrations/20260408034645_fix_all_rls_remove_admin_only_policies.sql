/*
  # Fix All RLS Policies to Include Owners

  1. Problem
    - Many tables have duplicate RLS policies
    - Old policies only check for 'admin' role, excluding 'owner' role
    - This prevents owners from managing their company data

  2. Solution
    - Drop old restrictive policies that only check for 'admin'
    - Keep newer policies that check for both 'admin' AND 'owner' roles

  3. Affected Tables
    - documents
    - document_sections
    - document_line_items
    - payments
    - expenses
    - deposits
    - accounts
    - account_balances
    - expense_categories
    - payment_categories
*/

-- DOCUMENTS TABLE
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "Admins can insert all documents" ON documents;
DROP POLICY IF EXISTS "Admins can update all documents" ON documents;
DROP POLICY IF EXISTS "Admins can delete all documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all trash" ON documents;

-- DOCUMENT_SECTIONS TABLE
DROP POLICY IF EXISTS "Admins can delete all sections" ON document_sections;
DROP POLICY IF EXISTS "Admins can insert all sections" ON document_sections;
DROP POLICY IF EXISTS "Admins can update all sections" ON document_sections;
DROP POLICY IF EXISTS "Admins can view all sections" ON document_sections;

-- DOCUMENT_LINE_ITEMS TABLE
DROP POLICY IF EXISTS "Admins can delete all line items" ON document_line_items;
DROP POLICY IF EXISTS "Admins can insert all line items" ON document_line_items;
DROP POLICY IF EXISTS "Admins can update all line items" ON document_line_items;
DROP POLICY IF EXISTS "Admins can view all line items" ON document_line_items;

-- PAYMENTS TABLE
DROP POLICY IF EXISTS "Admins can delete all payments" ON payments;
DROP POLICY IF EXISTS "Admins can insert all payments" ON payments;
DROP POLICY IF EXISTS "Admins can update all payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payment trash" ON payments;

-- EXPENSES TABLE
DROP POLICY IF EXISTS "Admins can delete all expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can insert all expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can update all expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can view all expense trash" ON expenses;

-- DEPOSITS TABLE
DROP POLICY IF EXISTS "Admins can delete all deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can insert all deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can update all deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can view all deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can view all deposit trash" ON deposits;

-- ACCOUNTS TABLE
DROP POLICY IF EXISTS "Admins can delete all accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can insert all accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can update all accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can view all accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can view all account trash" ON accounts;

-- ACCOUNT_BALANCES TABLE
DROP POLICY IF EXISTS "Admins can view all balances" ON account_balances;

-- EXPENSE_CATEGORIES TABLE
DROP POLICY IF EXISTS "Admins can delete all expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Admins can insert all expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Admins can update all expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Admins can view all expense categories" ON expense_categories;

-- PAYMENT_CATEGORIES TABLE
DROP POLICY IF EXISTS "Admins can delete all payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Admins can insert all payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Admins can update all payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Admins can view all payment categories" ON payment_categories;
