/*
  # Fix Critical Security Issues - Missing Indexes

  1. Missing Indexes on Foreign Keys
    - Add indexes for foreign key columns without covering indexes
    - Improves query performance significantly

  2. Important Notes
    - These indexes improve join performance and foreign key constraint checks
    - No data changes, only performance optimizations
*/

-- Add missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_account_transfers_created_by ON account_transfers(created_by);
CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);
CREATE INDEX IF NOT EXISTS idx_deposits_payment_category_id ON deposits(payment_category_id);
CREATE INDEX IF NOT EXISTS idx_documents_currency ON documents(currency);
CREATE INDEX IF NOT EXISTS idx_payments_currency ON payments(currency);
