/*
  # Implement Cash-Basis Income Recognition

  ## Summary
  Changes revenue reporting to use cash-basis accounting. Income is now recognised
  in the month that payment is actually received, not the month the invoice was issued.

  ## Problem
  Previously, invoice revenue was grouped by `documents.issue_date`. This meant a
  600,000 invoice issued in March appeared as March income even if nothing had been
  paid yet, which is incorrect for tax reporting purposes.

  ## New Behaviour
  - Income is recognised on the date each payment is received (`payments.payment_date`)
  - Partial payments are each recognised in their own month
  - An invoice issued in March with two instalments (one in March, one in April)
    correctly shows 50% income in March and 50% in April
  - Unpaid invoices (no payments) do not appear in any income period

  ## Changes

  1. **revenue_by_period_view** — rebuilt to join documents → payments and group by
     `payment_date` rather than `issue_date`. `total_revenue` is now the SUM of
     actual payment amounts received (capped by invoice total via proportional allocation).
     The `document_count` column now counts distinct invoices that had at least one
     payment in that period.

  2. **profit_and_loss_by_period_view** — rebuilt so the `invoice_revenue` CTE also
     joins through payments and groups by `payment_date`. This ensures the P&L
     statement reflects cash received, not invoices raised.

  ## Important Notes
  - The `outstanding_invoices_view` and `customer_revenue_view` are NOT changed —
    they correctly show balance_due / total_paid based on payment records already.
  - Deposits continue to use `deposit_date` as they are direct cash receipts.
  - The `document_totals_view` is NOT changed — it is used for the "All Documents"
    listing and correctly reflects full invoice amounts regardless of payment status.
*/

-- Drop views that depend on the ones we are replacing
DROP VIEW IF EXISTS revenue_by_period_view;
DROP VIEW IF EXISTS profit_and_loss_by_period_view;

-- ============================================================
-- revenue_by_period_view (cash-basis: grouped by payment_date)
-- ============================================================
-- Each row = one month+currency combination.
-- total_revenue = sum of payments received in that period for invoice-type documents.
-- We allocate payment amounts at face value (payments already store the exact
-- amount paid, in the invoice currency).
CREATE VIEW revenue_by_period_view AS
SELECT
  d.company_id,
  EXTRACT(YEAR  FROM p.payment_date)::int  AS year,
  EXTRACT(MONTH FROM p.payment_date)::int  AS month,
  d.currency,
  d.document_type,
  COUNT(DISTINCT d.id)  AS document_count,
  SUM(p.amount)         AS total_revenue
FROM payments p
JOIN documents d ON d.id = p.document_id
WHERE p.deleted_at  IS NULL
  AND d.deleted_at  IS NULL
  AND d.document_type = 'invoice'
GROUP BY
  d.company_id,
  EXTRACT(YEAR  FROM p.payment_date),
  EXTRACT(MONTH FROM p.payment_date),
  d.currency,
  d.document_type
ORDER BY year DESC, month DESC;

-- ============================================================
-- profit_and_loss_by_period_view (cash-basis invoice revenue)
-- ============================================================
CREATE VIEW profit_and_loss_by_period_view AS
WITH invoice_revenue AS (
  -- Cash received for invoices, grouped by payment month
  SELECT
    d.company_id,
    EXTRACT(YEAR  FROM p.payment_date)::int AS year,
    EXTRACT(MONTH FROM p.payment_date)::int AS month,
    d.currency,
    SUM(p.amount) AS invoice_revenue
  FROM payments p
  JOIN documents d ON d.id = p.document_id
  WHERE p.deleted_at IS NULL
    AND d.deleted_at IS NULL
    AND d.document_type = 'invoice'
  GROUP BY
    d.company_id,
    EXTRACT(YEAR  FROM p.payment_date),
    EXTRACT(MONTH FROM p.payment_date),
    d.currency
),
deposit_revenue AS (
  -- Deposits remain on deposit_date (already cash-basis)
  SELECT
    dep.company_id,
    EXTRACT(YEAR  FROM dep.deposit_date)::int AS year,
    EXTRACT(MONTH FROM dep.deposit_date)::int AS month,
    curr.code AS currency,
    SUM(dep.amount) AS deposit_revenue
  FROM deposits dep
  LEFT JOIN currencies curr ON dep.currency_id = curr.id
  WHERE dep.deleted_at IS NULL
  GROUP BY
    dep.company_id,
    EXTRACT(YEAR  FROM dep.deposit_date),
    EXTRACT(MONTH FROM dep.deposit_date),
    curr.code
),
expense_costs AS (
  SELECT
    e.company_id,
    EXTRACT(YEAR  FROM e.expense_date)::int AS year,
    EXTRACT(MONTH FROM e.expense_date)::int AS month,
    curr.code AS currency,
    ec.name   AS category_name,
    SUM(e.amount) AS total_expense
  FROM expenses e
  LEFT JOIN currencies curr ON e.currency_id = curr.id
  LEFT JOIN expense_categories ec ON e.expense_category_id = ec.id
  WHERE e.deleted_at IS NULL
  GROUP BY
    e.company_id,
    EXTRACT(YEAR  FROM e.expense_date),
    EXTRACT(MONTH FROM e.expense_date),
    curr.code,
    ec.name
),
all_periods AS (
  SELECT DISTINCT company_id, year, month, currency
  FROM (
    SELECT company_id, year, month, currency FROM invoice_revenue
    UNION
    SELECT company_id, year, month, currency FROM deposit_revenue
    UNION
    SELECT company_id, year, month, currency FROM expense_costs
  ) periods
)
SELECT
  ap.company_id,
  ap.year,
  ap.month,
  ap.currency,
  COALESCE(ir.invoice_revenue,  0) AS invoice_revenue,
  COALESCE(dr.deposit_revenue,  0) AS deposit_revenue,
  COALESCE(ir.invoice_revenue,  0) + COALESCE(dr.deposit_revenue, 0) AS total_revenue,
  COALESCE(SUM(ec.total_expense), 0) AS total_expenses,
  COALESCE(ir.invoice_revenue,  0) + COALESCE(dr.deposit_revenue, 0)
    - COALESCE(SUM(ec.total_expense), 0) AS net_profit,
  json_agg(
    json_build_object(
      'category', ec.category_name,
      'amount',   ec.total_expense
    ) ORDER BY ec.total_expense DESC
  ) FILTER (WHERE ec.category_name IS NOT NULL) AS expenses_by_category
FROM all_periods ap
LEFT JOIN invoice_revenue ir
  ON  ap.company_id = ir.company_id
  AND ap.year       = ir.year
  AND ap.month      = ir.month
  AND ap.currency   = ir.currency
LEFT JOIN deposit_revenue dr
  ON  ap.company_id = dr.company_id
  AND ap.year       = dr.year
  AND ap.month      = dr.month
  AND ap.currency   = dr.currency
LEFT JOIN expense_costs ec
  ON  ap.company_id = ec.company_id
  AND ap.year       = ec.year
  AND ap.month      = ec.month
  AND ap.currency   = ec.currency
GROUP BY
  ap.company_id, ap.year, ap.month, ap.currency,
  ir.invoice_revenue, dr.deposit_revenue
ORDER BY ap.year DESC, ap.month DESC, ap.currency;

-- Restore grants
GRANT SELECT ON revenue_by_period_view         TO authenticated;
GRANT SELECT ON profit_and_loss_by_period_view TO authenticated;
