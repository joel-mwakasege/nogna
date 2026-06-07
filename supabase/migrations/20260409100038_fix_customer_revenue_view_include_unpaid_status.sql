/*
  # Fix Customer Revenue View - Include 'unpaid' Status

  ## Problem
  The customer_revenue_view counted outstanding_invoices and total_outstanding only for
  statuses 'pending', 'overdue', 'partially_paid', missing the 'unpaid' status used in this system.

  ## Changes
  - Recreate customer_revenue_view to include 'unpaid' in all outstanding-related calculations
*/

CREATE OR REPLACE VIEW customer_revenue_view AS
SELECT
  c.company_id,
  c.id AS customer_id,
  c.name AS customer_name,
  c.email AS customer_email,
  COUNT(DISTINCT d.id) AS total_invoices,
  COUNT(DISTINCT CASE WHEN d.status = 'paid' THEN d.id ELSE NULL::uuid END) AS paid_invoices,
  COUNT(DISTINCT CASE WHEN d.status = ANY(ARRAY['pending', 'overdue', 'partially_paid', 'unpaid']) THEN d.id ELSE NULL::uuid END) AS outstanding_invoices,
  COALESCE(SUM(
    CASE WHEN d.status = 'paid' THEN
      CASE
        WHEN (dli.group_id IS NOT NULL AND dli.is_group_parent = false) THEN 0::numeric
        ELSE (((((dli.units * dli.days) * dli.unit_cost) * COALESCE(ds.units_multiplier, 1::numeric)) * (1::numeric - (COALESCE(d.discount_percent, 0::numeric) / 100::numeric))) * (1::numeric + (COALESCE(d.tax_percent, 0::numeric) / 100::numeric)))
      END
    ELSE NULL::numeric END
  ), 0::numeric) AS total_paid,
  COALESCE(SUM(
    CASE WHEN d.status = ANY(ARRAY['pending', 'overdue', 'partially_paid', 'unpaid']) THEN
      CASE
        WHEN (dli.group_id IS NOT NULL AND dli.is_group_parent = false) THEN 0::numeric
        ELSE (((((dli.units * dli.days) * dli.unit_cost) * COALESCE(ds.units_multiplier, 1::numeric)) * (1::numeric - (COALESCE(d.discount_percent, 0::numeric) / 100::numeric))) * (1::numeric + (COALESCE(d.tax_percent, 0::numeric) / 100::numeric)))
      END
    ELSE NULL::numeric END
  ), 0::numeric) AS total_outstanding,
  MAX(d.issue_date) AS last_invoice_date,
  c.created_at
FROM customers c
LEFT JOIN documents d ON (c.id = d.customer_id AND d.document_type = 'invoice' AND d.deleted_at IS NULL)
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE c.deleted_at IS NULL
GROUP BY c.company_id, c.id, c.name, c.email, c.created_at;
