/*
  # Recalculate Account Balances - Exclude Payments from Deleted Documents

  1. Purpose
    - Fix account balances to exclude payments that belong to soft-deleted documents
    - Previously, we only checked if payments.deleted_at was NULL
    - Now we also check if the parent document is soft-deleted

  2. Changes
    - Clear all existing account balances
    - Recalculate from scratch, excluding:
      - Payments where payment.deleted_at IS NOT NULL
      - Payments where document.deleted_at IS NOT NULL
    - Continue excluding soft-deleted expenses, deposits, and transfers

  3. Important Notes
    - This fixes the issue where deleted invoices still show in account balances
    - Payments are only counted if both the payment AND its document are active
*/

-- Clear all existing account balances
DELETE FROM account_balances;

-- Recalculate all balances from active transactions
WITH all_transactions AS (
  -- Payments (credit/add to account) - exclude payments from deleted documents
  SELECT 
    p.account_id,
    p.currency,
    SUM(p.amount) as total_amount
  FROM payments p
  LEFT JOIN documents d ON p.document_id = d.id
  WHERE p.deleted_at IS NULL 
    AND (d.id IS NULL OR d.deleted_at IS NULL)
  GROUP BY p.account_id, p.currency
  
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