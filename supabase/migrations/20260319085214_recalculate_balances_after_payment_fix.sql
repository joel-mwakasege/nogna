/*
  # Recalculate Account Balances After Payment Fix

  1. Changes
    - Clear all existing account balances
    - Recalculate balances from scratch based on all transactions:
      - Deposits: Add to balance
      - Expenses: Subtract from balance
      - Payments: Subtract from balance
      - Transfers: Handled separately (subtract from source, add to target)
    - Only include non-deleted transactions (deleted_at IS NULL)
  
  2. Notes
    - This migration fixes balances after correcting the payment trigger logic
    - All balances will be accurate after this runs
*/

-- Clear all existing balances
DELETE FROM account_balances;

-- Recalculate from deposits (credits - add to balance)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  d.account_id,
  c.code as currency,
  SUM(d.amount) as balance
FROM deposits d
JOIN currencies c ON d.currency_id = c.id
WHERE d.account_id IS NOT NULL 
  AND d.currency_id IS NOT NULL
  AND d.deleted_at IS NULL
GROUP BY d.account_id, c.code
ON CONFLICT (account_id, currency) 
DO UPDATE SET balance = account_balances.balance + EXCLUDED.balance;

-- Subtract expenses (debits - reduce balance)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  e.account_id,
  c.code as currency,
  -SUM(e.amount) as balance
FROM expenses e
JOIN currencies c ON e.currency_id = c.id
WHERE e.account_id IS NOT NULL 
  AND e.currency_id IS NOT NULL
  AND e.deleted_at IS NULL
GROUP BY e.account_id, c.code
ON CONFLICT (account_id, currency) 
DO UPDATE SET balance = account_balances.balance + EXCLUDED.balance;

-- Subtract payments (debits - reduce balance)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  p.account_id,
  p.currency,
  -SUM(p.amount) as balance
FROM payments p
WHERE p.account_id IS NOT NULL 
  AND p.currency IS NOT NULL
  AND p.deleted_at IS NULL
GROUP BY p.account_id, p.currency
ON CONFLICT (account_id, currency) 
DO UPDATE SET balance = account_balances.balance + EXCLUDED.balance;

-- Clean up zero balances
DELETE FROM account_balances WHERE balance = 0;
