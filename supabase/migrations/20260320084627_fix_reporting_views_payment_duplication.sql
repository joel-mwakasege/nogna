/*
  # Fix Reporting Views - Payment Duplication Issue
  
  ## Summary
  The reporting views were duplicating payment amounts due to JOIN with document_line_items.
  When a document has multiple line items, each payment gets multiplied by the number of line items.
  
  ## Problem Example
  Quote-12 has:
  - 1 payment of $6,194.52
  - 39 line items (including grouped children)
  - Result: Payment counted as $241,586.28 (6194.52 × 39)
  
  ## Solution
  Calculate payments separately using a subquery to avoid the cartesian product created
  by joining payments with line items.
  
  ## Changes Made
  1. outstanding_invoices_view - Use subquery for payment calculation
  2. customer_revenue_view - Calculate payments independently per document
*/

-- Drop existing views
DROP VIEW IF EXISTS outstanding_invoices_view;
DROP VIEW IF EXISTS customer_revenue_view;

-- Recreate outstanding invoices view with correct payment calculation
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
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
        * (1 - COALESCE(d.discount_percent, 0) / 100)
        * (1 + COALESCE(d.tax_percent, 0) / 100)
    END
  ) as amount_due,
  COALESCE((
    SELECT SUM(p.amount) 
    FROM payments p 
    WHERE p.document_id = d.id 
      AND p.deleted_at IS NULL
  ), 0) as amount_paid,
  SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
        * (1 - COALESCE(d.discount_percent, 0) / 100)
        * (1 + COALESCE(d.tax_percent, 0) / 100)
    END
  ) - COALESCE((
    SELECT SUM(p.amount) 
    FROM payments p 
    WHERE p.document_id = d.id 
      AND p.deleted_at IS NULL
  ), 0) as balance_due
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.document_type = 'invoice' 
  AND d.status IN ('pending', 'overdue', 'partially_paid')
  AND d.deleted_at IS NULL
GROUP BY d.id, d.document_number, d.customer_id, c.name, c.email, d.currency, d.issue_date, d.status
HAVING SUM(
  CASE 
    WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
    ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
      * (1 - COALESCE(d.discount_percent, 0) / 100)
      * (1 + COALESCE(d.tax_percent, 0) / 100)
  END
) - COALESCE((
  SELECT SUM(p.amount) 
  FROM payments p 
  WHERE p.document_id = d.id 
    AND p.deleted_at IS NULL
), 0) > 0
ORDER BY days_outstanding DESC;

-- Recreate customer revenue view with correct payment calculation
-- Use document_totals_view which already calculates totals correctly
CREATE VIEW customer_revenue_view AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  c.email as customer_email,
  COUNT(DISTINCT dt.document_id) as total_invoices,
  COUNT(DISTINCT CASE WHEN dt.status = 'paid' THEN dt.document_id END) as paid_invoices,
  COUNT(DISTINCT CASE WHEN dt.status IN ('pending', 'overdue', 'partially_paid') THEN dt.document_id END) as outstanding_invoices,
  COALESCE(SUM(
    CASE WHEN dt.status IN ('paid', 'partially_paid') THEN 
      (SELECT SUM(p.amount) FROM payments p WHERE p.document_id = dt.document_id AND p.deleted_at IS NULL)
    END
  ), 0) as total_paid,
  COALESCE(SUM(
    CASE WHEN dt.status IN ('pending', 'overdue', 'partially_paid') THEN 
      dt.total_amount - COALESCE((
        SELECT SUM(p.amount) 
        FROM payments p 
        WHERE p.document_id = dt.document_id 
          AND p.deleted_at IS NULL
      ), 0)
    END
  ), 0) as total_outstanding,
  MAX(dt.issue_date) as last_invoice_date,
  c.created_at
FROM customers c
LEFT JOIN document_totals_view dt ON c.id = dt.customer_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.email, c.created_at;

-- Re-grant access to views
GRANT SELECT ON customer_revenue_view TO authenticated;
GRANT SELECT ON outstanding_invoices_view TO authenticated;
