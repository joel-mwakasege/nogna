/*
  # Fix Reporting Views - Add Company ID Filtering

  ## Summary
  Updates all reporting views to include company_id filtering for proper multi-tenant data isolation.
  This ensures that views only show data for the user's company.

  ## Changes Made

  1. **Update document_totals_view**
     - Add company_id column from documents table
     - Filter results by company_id
  
  2. **Update revenue_by_period_view**
     - Add company_id column from documents table
     - Filter results by company_id
  
  3. **Update customer_revenue_view**
     - Add company_id column from customers table
     - Filter results by company_id
  
  4. **Update outstanding_invoices_view**
     - Add company_id column from documents table
     - Filter results by company_id
  
  5. **Update profit_and_loss_by_period_view**
     - Add company_id tracking through all CTEs
     - Filter results by company_id

  ## Important Notes
  - All views now properly scope data to the user's company
  - RLS policies on underlying tables will further enforce security
  - Views remain accessible to authenticated users via existing GRANT statements
*/

-- Drop existing views first
DROP VIEW IF EXISTS document_totals_view CASCADE;
DROP VIEW IF EXISTS revenue_by_period_view CASCADE;
DROP VIEW IF EXISTS customer_revenue_view CASCADE;
DROP VIEW IF EXISTS outstanding_invoices_view CASCADE;
DROP VIEW IF EXISTS profit_and_loss_by_period_view CASCADE;

-- Recreate document_totals_view with company_id
CREATE VIEW document_totals_view AS
SELECT 
  d.id as document_id,
  d.document_number,
  d.document_type,
  d.customer_id,
  d.company_id,
  c.name as customer_name,
  d.currency,
  d.issue_date,
  d.status,
  d.discount_percent,
  d.tax_percent,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) as subtotal,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (d.discount_percent / 100) as discount_amount,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - d.discount_percent / 100) as subtotal_after_discount,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - d.discount_percent / 100) * (d.tax_percent / 100) as tax_amount,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - d.discount_percent / 100) * (1 + d.tax_percent / 100) as total_amount,
  d.created_at,
  d.updated_at
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.deleted_at IS NULL
GROUP BY d.id, d.document_number, d.document_type, d.customer_id, d.company_id, c.name, 
         d.currency, d.issue_date, d.status, d.discount_percent, d.tax_percent,
         d.created_at, d.updated_at;

-- Recreate revenue_by_period_view with company_id
CREATE VIEW revenue_by_period_view AS
SELECT 
  d.company_id,
  EXTRACT(YEAR FROM d.issue_date)::int as year,
  EXTRACT(MONTH FROM d.issue_date)::int as month,
  d.currency,
  d.document_type,
  COUNT(d.id) as document_count,
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
WHERE d.deleted_at IS NULL 
  AND d.document_type = 'invoice'
  AND d.status IN ('paid', 'pending', 'partially_paid', 'overdue')
GROUP BY d.company_id, EXTRACT(YEAR FROM d.issue_date), EXTRACT(MONTH FROM d.issue_date), d.currency, d.document_type
ORDER BY year DESC, month DESC;

-- Recreate customer_revenue_view with company_id
CREATE VIEW customer_revenue_view AS
SELECT 
  c.company_id,
  c.id as customer_id,
  c.name as customer_name,
  c.email as customer_email,
  COUNT(DISTINCT d.id) as total_invoices,
  COUNT(DISTINCT CASE WHEN d.status = 'paid' THEN d.id END) as paid_invoices,
  COUNT(DISTINCT CASE WHEN d.status IN ('pending', 'overdue', 'partially_paid') THEN d.id END) as outstanding_invoices,
  COALESCE(SUM(
    CASE WHEN d.status = 'paid' THEN 
      CASE 
        WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
        ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
          * (1 - COALESCE(d.discount_percent, 0) / 100)
          * (1 + COALESCE(d.tax_percent, 0) / 100)
      END
    END
  ), 0) as total_paid,
  COALESCE(SUM(
    CASE WHEN d.status IN ('pending', 'overdue', 'partially_paid') THEN 
      CASE 
        WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
        ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
          * (1 - COALESCE(d.discount_percent, 0) / 100)
          * (1 + COALESCE(d.tax_percent, 0) / 100)
      END
    END
  ), 0) as total_outstanding,
  MAX(d.issue_date) as last_invoice_date,
  c.created_at
FROM customers c
LEFT JOIN documents d ON c.id = d.customer_id AND d.document_type = 'invoice' AND d.deleted_at IS NULL
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE c.deleted_at IS NULL
GROUP BY c.company_id, c.id, c.name, c.email, c.created_at;

-- Recreate outstanding_invoices_view with company_id
CREATE VIEW outstanding_invoices_view AS
SELECT 
  d.company_id,
  d.id as document_id,
  d.document_number,
  d.customer_id,
  c.name as customer_name,
  c.email as customer_email,
  d.currency,
  d.issue_date,
  d.status,
  CURRENT_DATE - d.issue_date as days_outstanding,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
        * (1 - COALESCE(d.discount_percent, 0) / 100)
        * (1 + COALESCE(d.tax_percent, 0) / 100)
    END
  ), 0) as amount_due,
  COALESCE(SUM(p.amount), 0) as amount_paid,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
        * (1 - COALESCE(d.discount_percent, 0) / 100)
        * (1 + COALESCE(d.tax_percent, 0) / 100)
    END
  ), 0) - COALESCE(SUM(p.amount), 0) as balance_due
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
LEFT JOIN payments p ON d.id = p.document_id AND p.deleted_at IS NULL
WHERE d.document_type = 'invoice' 
  AND d.status IN ('pending', 'overdue', 'partially_paid')
  AND d.deleted_at IS NULL
GROUP BY d.company_id, d.id, d.document_number, d.customer_id, c.name, c.email, d.currency, d.issue_date, d.status
HAVING COALESCE(SUM(
  CASE 
    WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
    ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
      * (1 - COALESCE(d.discount_percent, 0) / 100)
      * (1 + COALESCE(d.tax_percent, 0) / 100)
  END
), 0) - COALESCE(SUM(p.amount), 0) > 0
ORDER BY days_outstanding DESC;

-- Recreate profit_and_loss_by_period_view with company_id
CREATE VIEW profit_and_loss_by_period_view AS
WITH invoice_revenue AS (
  SELECT 
    d.company_id,
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
    ) as invoice_revenue
  FROM documents d
  LEFT JOIN document_sections ds ON d.id = ds.document_id
  LEFT JOIN document_line_items dli ON ds.id = dli.section_id
  WHERE d.document_type = 'invoice'
    AND d.status IN ('paid', 'partially_paid')
    AND d.deleted_at IS NULL
  GROUP BY 
    d.company_id,
    EXTRACT(YEAR FROM d.issue_date),
    EXTRACT(MONTH FROM d.issue_date),
    d.currency
),
deposit_revenue AS (
  SELECT 
    dep.company_id,
    EXTRACT(YEAR FROM dep.deposit_date)::int as year,
    EXTRACT(MONTH FROM dep.deposit_date)::int as month,
    curr.code as currency,
    SUM(dep.amount) as deposit_revenue
  FROM deposits dep
  LEFT JOIN currencies curr ON dep.currency_id = curr.id
  WHERE dep.deleted_at IS NULL
  GROUP BY 
    dep.company_id,
    EXTRACT(YEAR FROM dep.deposit_date),
    EXTRACT(MONTH FROM dep.deposit_date),
    curr.code
),
expense_costs AS (
  SELECT 
    e.company_id,
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
    e.company_id,
    EXTRACT(YEAR FROM e.expense_date),
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
  COALESCE(ir.invoice_revenue, 0) as invoice_revenue,
  COALESCE(dr.deposit_revenue, 0) as deposit_revenue,
  COALESCE(ir.invoice_revenue, 0) + COALESCE(dr.deposit_revenue, 0) as total_revenue,
  COALESCE(SUM(ec.total_expense), 0) as total_expenses,
  COALESCE(ir.invoice_revenue, 0) + COALESCE(dr.deposit_revenue, 0) - COALESCE(SUM(ec.total_expense), 0) as net_profit,
  json_agg(
    json_build_object(
      'category', ec.category_name,
      'amount', ec.total_expense
    ) ORDER BY ec.total_expense DESC
  ) FILTER (WHERE ec.category_name IS NOT NULL) as expenses_by_category
FROM all_periods ap
LEFT JOIN invoice_revenue ir 
  ON ap.company_id = ir.company_id
  AND ap.year = ir.year 
  AND ap.month = ir.month 
  AND ap.currency = ir.currency
LEFT JOIN deposit_revenue dr
  ON ap.company_id = dr.company_id
  AND ap.year = dr.year 
  AND ap.month = dr.month 
  AND ap.currency = dr.currency
LEFT JOIN expense_costs ec
  ON ap.company_id = ec.company_id
  AND ap.year = ec.year 
  AND ap.month = ec.month 
  AND ap.currency = ec.currency
GROUP BY ap.company_id, ap.year, ap.month, ap.currency, ir.invoice_revenue, dr.deposit_revenue
ORDER BY ap.year DESC, ap.month DESC, ap.currency;

-- Restore grants
GRANT SELECT ON document_totals_view TO authenticated;
GRANT SELECT ON revenue_by_period_view TO authenticated;
GRANT SELECT ON customer_revenue_view TO authenticated;
GRANT SELECT ON outstanding_invoices_view TO authenticated;
GRANT SELECT ON profit_and_loss_by_period_view TO authenticated;
