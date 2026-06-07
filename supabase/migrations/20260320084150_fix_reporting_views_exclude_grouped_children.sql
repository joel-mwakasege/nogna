/*
  # Fix Reporting Views - Exclude Grouped Child Items
  
  ## Summary
  The reporting views (revenue_by_period_view, outstanding_invoices_view, customer_revenue_view)
  were incorrectly including grouped child items in their calculations, causing inflated totals.
  
  ## Problem
  When line items are grouped (e.g., "Video Equipments" with children like "Camera Operator"),
  only the parent item should contribute to totals. Child items are for display only.
  
  ## Solution
  Update all three views to exclude line items where:
  - group_id IS NOT NULL AND is_group_parent = false
  
  ## Example Impact
  Quote-12 was showing $20,236.53 instead of the correct $6,194.53 because
  all 8 child items under "Video Equipments" were being counted at $1000 each,
  when only the parent should count.
  
  ## Changes Made
  1. revenue_by_period_view - Exclude grouped children from revenue calculation
  2. outstanding_invoices_view - Exclude grouped children from amount_due calculation
  3. customer_revenue_view - Exclude grouped children from all aggregations
*/

-- Drop existing views
DROP VIEW IF EXISTS revenue_by_period_view;
DROP VIEW IF EXISTS outstanding_invoices_view;
DROP VIEW IF EXISTS customer_revenue_view;

-- Recreate revenue by period view excluding grouped children
CREATE VIEW revenue_by_period_view AS
SELECT 
  EXTRACT(YEAR FROM d.issue_date)::int as year,
  EXTRACT(MONTH FROM d.issue_date)::int as month,
  d.currency,
  d.document_type,
  COUNT(DISTINCT d.id) as document_count,
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
GROUP BY EXTRACT(YEAR FROM d.issue_date), EXTRACT(MONTH FROM d.issue_date), d.currency, d.document_type
ORDER BY year DESC, month DESC;

-- Recreate outstanding invoices view excluding grouped children
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
  COALESCE(SUM(p.amount), 0) as amount_paid,
  SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
        * (1 - COALESCE(d.discount_percent, 0) / 100)
        * (1 + COALESCE(d.tax_percent, 0) / 100)
    END
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
  CASE 
    WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
    ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
      * (1 - COALESCE(d.discount_percent, 0) / 100)
      * (1 + COALESCE(d.tax_percent, 0) / 100)
  END
) - COALESCE(SUM(p.amount), 0) > 0
ORDER BY days_outstanding DESC;

-- Recreate customer revenue view excluding grouped children
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
