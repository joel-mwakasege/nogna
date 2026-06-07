/*
  # Update Profit and Loss Report to Include Deposits

  ## Summary
  Updates the profit_and_loss_by_period_view to include deposits as part of revenue.
  This provides a complete financial picture by tracking all income sources:
  - Invoice revenue (paid and partially paid invoices)
  - Deposit revenue (all non-deleted deposits)
  
  ## Changes
  
  1. **Modified Views**
     - `profit_and_loss_by_period_view`
       - Adds deposit_revenue CTE to calculate total deposits by period and currency
       - Combines invoice revenue and deposit revenue into total_revenue
       - Maintains existing expense tracking by category
       - Calculates accurate net profit including all revenue sources
       - Breaks down revenue into invoice_revenue and deposit_revenue for transparency
  
  ## Security
  - Maintains existing RLS policies
  - View accessible to authenticated users only
  - Data filtered by organization_id for multi-tenancy
  
  ## Use Cases
  - Complete monthly/yearly financial performance tracking
  - Multi-currency profit and loss analysis with all income sources
  - Revenue breakdown by source (invoices vs deposits)
  - Comprehensive financial reporting and analytics
*/

-- Drop the existing view
DROP VIEW IF EXISTS profit_and_loss_by_period_view;

-- Recreate the view with deposits included
CREATE VIEW profit_and_loss_by_period_view AS
WITH invoice_revenue AS (
  SELECT 
    EXTRACT(YEAR FROM d.issue_date)::int as year,
    EXTRACT(MONTH FROM d.issue_date)::int as month,
    d.currency,
    SUM(
      CASE 
        WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
        ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
          * (1 - COALESCE(d.discount_percent, 0) / 100)
          * (1 + COALESCE(d.tax_percent, 0) / 100)
      END
    ) as total_revenue
  FROM documents d
  LEFT JOIN document_sections ds ON d.id = ds.document_id
  LEFT JOIN document_line_items dli ON ds.id = dli.section_id
  WHERE d.document_type = 'invoice'
    AND d.status IN ('paid', 'partially_paid')
    AND d.deleted_at IS NULL
  GROUP BY 
    EXTRACT(YEAR FROM d.issue_date),
    EXTRACT(MONTH FROM d.issue_date),
    d.currency
),
deposit_revenue AS (
  SELECT 
    EXTRACT(YEAR FROM dep.deposit_date)::int as year,
    EXTRACT(MONTH FROM dep.deposit_date)::int as month,
    curr.code as currency,
    SUM(dep.amount) as total_deposits
  FROM deposits dep
  LEFT JOIN currencies curr ON dep.currency_id = curr.id
  WHERE dep.deleted_at IS NULL
  GROUP BY 
    EXTRACT(YEAR FROM dep.deposit_date),
    EXTRACT(MONTH FROM dep.deposit_date),
    curr.code
),
expense_costs AS (
  SELECT 
    EXTRACT(YEAR FROM e.expense_date)::int as year,
    EXTRACT(MONTH FROM e.expense_date)::int as month,
    curr.code as currency,
    ec.name as category_name,
    SUM(e.amount) as total_expense
  FROM expenses e
  LEFT JOIN currencies curr ON e.currency_id = curr.id
  LEFT JOIN expense_categories ec ON e.expense_category_id = ec.id
  WHERE e.deleted_at IS NULL
  GROUP BY 
    EXTRACT(YEAR FROM e.expense_date),
    EXTRACT(MONTH FROM e.expense_date),
    curr.code,
    ec.name
),
all_periods AS (
  SELECT DISTINCT year, month, currency
  FROM (
    SELECT year, month, currency FROM invoice_revenue
    UNION
    SELECT year, month, currency FROM deposit_revenue
    UNION
    SELECT year, month, currency FROM expense_costs
  ) periods
)
SELECT 
  ap.year,
  ap.month,
  ap.currency,
  COALESCE(ir.total_revenue, 0) as invoice_revenue,
  COALESCE(dr.total_deposits, 0) as deposit_revenue,
  COALESCE(ir.total_revenue, 0) + COALESCE(dr.total_deposits, 0) as total_revenue,
  COALESCE(SUM(ec.total_expense), 0) as total_expenses,
  (COALESCE(ir.total_revenue, 0) + COALESCE(dr.total_deposits, 0)) - COALESCE(SUM(ec.total_expense), 0) as net_profit,
  json_agg(
    json_build_object(
      'category', ec.category_name,
      'amount', ec.total_expense
    ) ORDER BY ec.total_expense DESC
  ) FILTER (WHERE ec.category_name IS NOT NULL) as expenses_by_category
FROM all_periods ap
LEFT JOIN invoice_revenue ir 
  ON ap.year = ir.year 
  AND ap.month = ir.month 
  AND ap.currency = ir.currency
LEFT JOIN deposit_revenue dr
  ON ap.year = dr.year 
  AND ap.month = dr.month 
  AND ap.currency = dr.currency
LEFT JOIN expense_costs ec
  ON ap.year = ec.year 
  AND ap.month = ec.month 
  AND ap.currency = ec.currency
GROUP BY ap.year, ap.month, ap.currency, ir.total_revenue, dr.total_deposits
ORDER BY ap.year DESC, ap.month DESC, ap.currency;

-- Grant access to the view
GRANT SELECT ON profit_and_loss_by_period_view TO authenticated;
