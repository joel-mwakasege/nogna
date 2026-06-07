/*
  # Fix Outstanding Invoices View - Include 'unpaid' Status

  ## Problem
  The outstanding_invoices_view only filtered for statuses: 'pending', 'overdue', 'partially_paid'.
  However, invoices in this system use the status 'unpaid' for unpaid invoices, causing the view to return no results.

  ## Changes
  - Recreate outstanding_invoices_view to also include 'unpaid' status alongside the existing statuses
*/

CREATE OR REPLACE VIEW outstanding_invoices_view AS
SELECT
  d.company_id,
  d.id AS document_id,
  d.document_number,
  d.customer_id,
  c.name AS customer_name,
  c.email AS customer_email,
  d.currency,
  d.issue_date,
  d.status,
  (CURRENT_DATE - d.issue_date) AS days_outstanding,
  COALESCE(SUM(
    CASE
      WHEN (dli.group_id IS NOT NULL AND dli.is_group_parent = false) THEN 0::numeric
      ELSE (((((dli.units * dli.days) * dli.unit_cost) * COALESCE(ds.units_multiplier, 1::numeric)) * (1::numeric - (COALESCE(d.discount_percent, 0::numeric) / 100::numeric))) * (1::numeric + (COALESCE(d.tax_percent, 0::numeric) / 100::numeric)))
    END
  ), 0::numeric) AS amount_due,
  COALESCE(SUM(p.amount), 0::numeric) AS amount_paid,
  (
    COALESCE(SUM(
      CASE
        WHEN (dli.group_id IS NOT NULL AND dli.is_group_parent = false) THEN 0::numeric
        ELSE (((((dli.units * dli.days) * dli.unit_cost) * COALESCE(ds.units_multiplier, 1::numeric)) * (1::numeric - (COALESCE(d.discount_percent, 0::numeric) / 100::numeric))) * (1::numeric + (COALESCE(d.tax_percent, 0::numeric) / 100::numeric)))
      END
    ), 0::numeric) - COALESCE(SUM(p.amount), 0::numeric)
  ) AS balance_due
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
LEFT JOIN payments p ON (d.id = p.document_id AND p.deleted_at IS NULL)
WHERE
  d.document_type = 'invoice'
  AND d.status = ANY(ARRAY['pending', 'overdue', 'partially_paid', 'unpaid'])
  AND d.deleted_at IS NULL
GROUP BY
  d.company_id, d.id, d.document_number, d.customer_id,
  c.name, c.email, d.currency, d.issue_date, d.status
HAVING (
  COALESCE(SUM(
    CASE
      WHEN (dli.group_id IS NOT NULL AND dli.is_group_parent = false) THEN 0::numeric
      ELSE (((((dli.units * dli.days) * dli.unit_cost) * COALESCE(ds.units_multiplier, 1::numeric)) * (1::numeric - (COALESCE(d.discount_percent, 0::numeric) / 100::numeric))) * (1::numeric + (COALESCE(d.tax_percent, 0::numeric) / 100::numeric)))
    END
  ), 0::numeric) - COALESCE(SUM(p.amount), 0::numeric)
) > 0::numeric
ORDER BY (CURRENT_DATE - d.issue_date) DESC;
