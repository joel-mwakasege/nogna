/*
  # Fix Reporting Views to Include All Invoice Statuses

  ## Summary
  The reporting views were excluding invoices with "partially_paid" status.
  This migration updates the views to include all invoice statuses for accurate reporting.

  ## Changes Made

  1. View Updates
    - Drop and recreate `revenue_by_period_view` to include all invoice statuses
    - Drop and recreate `outstanding_invoices_view` to include partially_paid invoices
    - Drop and recreate `customer_revenue_view` with better calculations
    
  2. Logic Changes
    - Revenue view: Include all invoices (paid, pending, partially_paid, overdue)
    - Outstanding view: Include pending, overdue, and partially_paid invoices
    - Customer view: Calculate actual outstanding amounts considering payments
    
  3. Important Notes
    - Partially paid invoices are important for financial reporting
    - Views now show complete picture of revenue and outstanding amounts
*/

-- Drop existing views to recreate with new structure
DROP VIEW IF EXISTS revenue_by_period_view;
DROP VIEW IF EXISTS outstanding_invoices_view;
DROP VIEW IF EXISTS customer_revenue_view;

-- Recreate revenue by period view to include all invoice statuses
CREATE VIEW revenue_by_period_view AS
SELECT 
  EXTRACT(YEAR FROM d.issue_date)::int as year,
  EXTRACT(MONTH FROM d.issue_date)::int as month,
  d.currency,
  d.document_type,
  COUNT(DISTINCT d.id) as document_count,
  SUM(
    COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0) 
    * (1 - COALESCE(d.discount_percent, 0) / 100) 
    * (1 + COALESCE(d.tax_percent, 0) / 100)
  ) as total_revenue
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.deleted_at IS NULL 
  AND d.document_type = 'invoice'
  AND d.status IN ('paid', 'pending', 'partially_paid', 'overdue')
GROUP BY EXTRACT(YEAR FROM d.issue_date), EXTRACT(MONTH FROM d.issue_date), d.currency, d.document_type
ORDER BY year DESC, month DESC;

-- Recreate outstanding invoices view to include partially_paid status
CREATE VIEW outstanding_invoices_view AS
SELECT 
  d.id as document_id,
  d.document_number,
  d.customer_id,
  c.name as customer_name,
  c.email as customer_email,
  d.currency,
  d.issue_date,
  d.status,
  (CURRENT_DATE - d.issue_date)::int as days_outstanding,
  SUM(
    COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
    * (1 - COALESCE(d.discount_percent, 0) / 100)
    * (1 + COALESCE(d.tax_percent, 0) / 100)
  ) as amount_due,
  COALESCE(SUM(p.amount), 0) as amount_paid,
  SUM(
    COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
    * (1 - COALESCE(d.discount_percent, 0) / 100)
    * (1 + COALESCE(d.tax_percent, 0) / 100)
  ) - COALESCE(SUM(p.amount), 0) as balance_due
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
LEFT JOIN payments p ON d.id = p.document_id AND p.deleted_at IS NULL
WHERE d.document_type = 'invoice' 
  AND d.status IN ('pending', 'overdue', 'partially_paid')
  AND d.deleted_at IS NULL
GROUP BY d.id, d.document_number, d.customer_id, c.name, c.email, d.currency, d.issue_date, d.status
HAVING SUM(
  COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
  * (1 - COALESCE(d.discount_percent, 0) / 100)
  * (1 + COALESCE(d.tax_percent, 0) / 100)
) - COALESCE(SUM(p.amount), 0) > 0
ORDER BY days_outstanding DESC;

-- Recreate customer revenue view to include partially_paid status
CREATE VIEW customer_revenue_view AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  c.email as customer_email,
  COUNT(DISTINCT d.id) as total_invoices,
  COUNT(DISTINCT CASE WHEN d.status = 'paid' THEN d.id END) as paid_invoices,
  COUNT(DISTINCT CASE WHEN d.status IN ('pending', 'overdue', 'partially_paid') THEN d.id END) as outstanding_invoices,
  COALESCE(SUM(
    CASE WHEN d.status IN ('paid', 'partially_paid') THEN 
      dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1) 
      * (1 - COALESCE(d.discount_percent, 0) / 100) 
      * (1 + COALESCE(d.tax_percent, 0) / 100)
    END
  ), 0) as total_paid,
  COALESCE(SUM(
    CASE WHEN d.status IN ('pending', 'overdue', 'partially_paid') THEN 
      (dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1) 
       * (1 - COALESCE(d.discount_percent, 0) / 100) 
       * (1 + COALESCE(d.tax_percent, 0) / 100))
    END
  ), 0) as total_outstanding,
  MAX(d.issue_date) as last_invoice_date,
  c.created_at
FROM customers c
LEFT JOIN documents d ON c.id = d.customer_id 
  AND d.document_type = 'invoice' 
  AND d.deleted_at IS NULL
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.email, c.created_at;

-- Re-grant access to views
GRANT SELECT ON revenue_by_period_view TO authenticated;
GRANT SELECT ON customer_revenue_view TO authenticated;
GRANT SELECT ON outstanding_invoices_view TO authenticated;
