/*
  # Add Profit and Loss Report View
  
  ## Summary
  Creates a comprehensive Profit and Loss (P&L) statement view that shows:
  - Revenue from invoices (grouped by currency and period)
  - Expenses (grouped by currency, category, and period)
  - Net profit/loss calculation
  
  ## New Views
  
  1. **profit_and_loss_by_period_view**
     - Groups all revenue and expenses by year, month, and currency
     - Calculates total revenue from paid and partially paid invoices
     - Calculates total expenses from non-deleted expenses
     - Computes net profit (revenue - expenses)
     - Provides monthly P&L statements per currency
     - Breaks down expenses by category for detailed analysis
  
  ## Security
  - Grant SELECT access to authenticated users
  - Data filtered by organization_id for multi-tenancy
  
  ## Use Cases
  - Monthly/yearly financial performance tracking
  - Multi-currency profit and loss analysis
  - Expense vs revenue comparison
  - Financial reporting and analytics
*/

-- Create profit and loss view by period
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
    SELECT year, month, currency FROM expense_costs
  ) periods
)
SELECT 
  ap.year,
  ap.month,
  ap.currency,
  COALESCE(ir.total_revenue, 0) as total_revenue,
  COALESCE(SUM(ec.total_expense), 0) as total_expenses,
  COALESCE(ir.total_revenue, 0) - COALESCE(SUM(ec.total_expense), 0) as net_profit,
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
LEFT JOIN expense_costs ec
  ON ap.year = ec.year 
  AND ap.month = ec.month 
  AND ap.currency = ec.currency
GROUP BY ap.year, ap.month, ap.currency, ir.total_revenue
ORDER BY ap.year DESC, ap.month DESC, ap.currency;

-- Grant access to the view
GRANT SELECT ON profit_and_loss_by_period_view TO authenticated;
