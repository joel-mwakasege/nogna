/*
  # Recalculate All Account Balances After Payment Fix

  ## Summary
  This migration recalculates all account balances from scratch to fix incorrect
  balances caused by the previous payment trigger logic bug.

  ## What This Does

  1. Reset all account balances to zero
  2. Recalculate balances from all active (non-deleted) transactions:
     - Expenses: DEDUCT from account balance (outgoing money)
     - Deposits: ADD to account balance (incoming money)
     - Payments: ADD to account balance (incoming money from invoices)
     - Transfers: DEDUCT from source, ADD to destination

  3. Clean up any zero balances after recalculation

  ## Important Notes
  - Only processes non-deleted transactions (deleted_at IS NULL)
  - Groups by account and currency for accurate multi-currency support
  - This is a data fix migration that should be run once
*/

-- Step 1: Reset all account balances to zero
UPDATE account_balances SET balance = 0, updated_at = now();

-- Step 2: Recalculate from expenses (deduct from accounts)
WITH expense_totals AS (
  SELECT 
    e.account_id,
    c.code as currency,
    SUM(e.amount) as total_amount
  FROM expenses e
  JOIN currencies c ON e.currency_id = c.id
  WHERE e.account_id IS NOT NULL 
    AND e.deleted_at IS NULL
  GROUP BY e.account_id, c.code
)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  account_id,
  currency,
  -total_amount  -- Expenses DEDUCT from balance
FROM expense_totals
ON CONFLICT (account_id, currency)
DO UPDATE SET
  balance = account_balances.balance - EXCLUDED.balance,  -- Note: EXCLUDED.balance is already negative
  updated_at = now();

-- Step 3: Recalculate from deposits (add to accounts)
WITH deposit_totals AS (
  SELECT 
    d.account_id,
    c.code as currency,
    SUM(d.amount) as total_amount
  FROM deposits d
  JOIN currencies c ON d.currency_id = c.id
  WHERE d.account_id IS NOT NULL 
    AND d.deleted_at IS NULL
  GROUP BY d.account_id, c.code
)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  account_id,
  currency,
  total_amount  -- Deposits ADD to balance
FROM deposit_totals
ON CONFLICT (account_id, currency)
DO UPDATE SET
  balance = account_balances.balance + EXCLUDED.balance,
  updated_at = now();

-- Step 4: Recalculate from payments (add to accounts - money received)
WITH payment_totals AS (
  SELECT 
    p.account_id,
    p.currency,
    SUM(p.amount) as total_amount
  FROM payments p
  WHERE p.account_id IS NOT NULL 
    AND p.currency IS NOT NULL
    AND p.deleted_at IS NULL
  GROUP BY p.account_id, p.currency
)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  account_id,
  currency,
  total_amount  -- Payments ADD to balance (money received from customers)
FROM payment_totals
ON CONFLICT (account_id, currency)
DO UPDATE SET
  balance = account_balances.balance + EXCLUDED.balance,
  updated_at = now();

-- Step 5: Recalculate from transfers (deduct from source, add to destination)
-- Process source accounts (deduct)
WITH transfer_source_totals AS (
  SELECT 
    t.from_account_id as account_id,
    t.currency,
    SUM(t.amount) as total_amount
  FROM account_transfers t
  WHERE t.from_account_id IS NOT NULL 
    AND t.deleted_at IS NULL
  GROUP BY t.from_account_id, t.currency
)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  account_id,
  currency,
  -total_amount  -- Transfers DEDUCT from source account
FROM transfer_source_totals
ON CONFLICT (account_id, currency)
DO UPDATE SET
  balance = account_balances.balance - EXCLUDED.balance,  -- Note: EXCLUDED.balance is already negative
  updated_at = now();

-- Process destination accounts (add)
WITH transfer_dest_totals AS (
  SELECT 
    t.to_account_id as account_id,
    t.currency,
    SUM(t.amount) as total_amount
  FROM account_transfers t
  WHERE t.to_account_id IS NOT NULL 
    AND t.deleted_at IS NULL
  GROUP BY t.to_account_id, t.currency
)
INSERT INTO account_balances (account_id, currency, balance)
SELECT 
  account_id,
  currency,
  total_amount  -- Transfers ADD to destination account
FROM transfer_dest_totals
ON CONFLICT (account_id, currency)
DO UPDATE SET
  balance = account_balances.balance + EXCLUDED.balance,
  updated_at = now();

-- Step 6: Clean up zero balances
DELETE FROM account_balances WHERE balance = 0;
