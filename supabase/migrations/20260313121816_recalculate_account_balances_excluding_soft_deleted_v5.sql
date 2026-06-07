/*
  # Recalculate Account Balances Excluding Soft-Deleted Payments

  1. Purpose
    - Remove payment amounts from soft-deleted invoices from account balances
    - Ensure account balances only reflect active (non-deleted) payments
    - Clean up historical data where soft-deleted payments were incorrectly counted

  2. Changes
    - Clear all existing account balances
    - Recalculate from scratch using only active transactions
    - Include: payments, expenses, deposits, and transfers
    - Exclude: any records with deleted_at IS NOT NULL

  3. Important Notes
    - This is a one-time cleanup migration
    - All account balances will be recalculated from transaction history
    - Only active (non-trashed) transactions are included
    - Zero balances are automatically cleaned up
*/

-- Clear all existing account balances
DELETE FROM account_balances;

-- Recalculate all balances from active transactions
WITH all_transactions AS (
  -- Payments (credit/add to account)
  SELECT 
    account_id,
    currency,
    SUM(amount) as total_amount
  FROM payments
  WHERE deleted_at IS NULL
  GROUP BY account_id, currency
  
  UNION ALL
  
  -- Expenses (debit/subtract from account)
  SELECT 
    e.account_id,
    c.code as currency,
    -SUM(e.amount + COALESCE(e.tax_amount, 0)) as total_amount
  FROM expenses e
  JOIN currencies c ON e.currency_id = c.id
  WHERE e.deleted_at IS NULL AND e.account_id IS NOT NULL
  GROUP BY e.account_id, c.code
  
  UNION ALL
  
  -- Deposits (credit/add to account)
  SELECT 
    account_id,
    currency_code as currency,
    SUM(amount + COALESCE(tax_amount, 0)) as total_amount
  FROM deposits
  WHERE deleted_at IS NULL AND account_id IS NOT NULL
  GROUP BY account_id, currency_code
  
  UNION ALL
  
  -- Transfers FROM account (debit/subtract)
  SELECT 
    from_account_id as account_id,
    currency,
    -SUM(amount) as total_amount
  FROM account_transfers
  WHERE deleted_at IS NULL
  GROUP BY from_account_id, currency
  
  UNION ALL
  
  -- Transfers TO account (credit/add)
  SELECT 
    to_account_id as account_id,
    currency,
    SUM(amount) as total_amount
  FROM account_transfers
  WHERE deleted_at IS NULL
  GROUP BY to_account_id, currency
)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  account_id,
  currency,
  SUM(total_amount) as balance
FROM all_transactions
GROUP BY account_id, currency
HAVING SUM(total_amount) != 0;