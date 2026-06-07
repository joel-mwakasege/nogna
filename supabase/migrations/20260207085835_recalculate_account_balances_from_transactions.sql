/*
  # Recalculate Account Balances from Transactions

  ## Summary
  This migration fixes incorrect account balances by recalculating them from actual
  payment and expense transactions, ensuring each currency is tracked separately.

  ## Changes Made

  1. Data Corrections
    - Clear all existing account_balances records
    - Recalculate balances from payments grouped by account_id and currency
    - Recalculate balances from expenses grouped by account_id and currency_id

  2. Important Notes
    - This migration recalculates all balances from scratch based on actual transactions
    - Payments add to account balances (positive)
    - Expenses subtract from account balances (negative)
    - Each currency is tracked separately per account
*/

-- Clear existing account balances (they were incorrectly migrated)
DELETE FROM account_balances;

-- Recalculate balances from payments
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  account_id,
  currency,
  SUM(amount) as balance
FROM payments
WHERE account_id IS NOT NULL
GROUP BY account_id, currency
ON CONFLICT (account_id, currency) 
DO UPDATE SET 
  balance = account_balances.balance + EXCLUDED.balance,
  updated_at = now();

-- Recalculate balances from expenses (subtract from balances)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  e.account_id,
  c.code as currency,
  -SUM(e.amount) as balance
FROM expenses e
JOIN currencies c ON e.currency_id = c.id
WHERE e.account_id IS NOT NULL
GROUP BY e.account_id, c.code
ON CONFLICT (account_id, currency) 
DO UPDATE SET 
  balance = account_balances.balance + EXCLUDED.balance,
  updated_at = now();
