/*
  # Align reporting totals with invoice grouped-item calculation

  The invoice UI intentionally calculates grouped items differently from
  ordinary line items:

  - grouped child: excluded
  - grouped parent: days * unit_cost
  - ordinary item: units * days * unit_cost

  The section units_multiplier applies after either calculation.

  Reporting previously multiplied grouped parents by units, which could
  massively inflate subtotal, VAT, invoice total, revenue and balances.
*/

DROP VIEW IF EXISTS revenue_by_period_view;
DROP VIEW IF EXISTS outstanding_invoices_view;
DROP VIEW IF EXISTS customer_revenue_view;
DROP VIEW IF EXISTS document_totals_view;

CREATE VIEW document_totals_view AS
SELECT
  d.id AS document_id,
  d.document_number,
  d.document_type,
  d.customer_id,
  c.name AS customer_name,
  d.currency,
  d.issue_date,
  d.status,
  d.discount_percent,
  d.tax_percent,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) AS line_items_total,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (COALESCE(d.discount_percent, 0) / 100) AS discount_amount,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) AS subtotal,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - COALESCE(d.discount_percent, 0) / 100)
     * (COALESCE(d.tax_percent, 0) / 100) AS tax_amount,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - COALESCE(d.discount_percent, 0) / 100)
     * (1 + COALESCE(d.tax_percent, 0) / 100) AS total_amount,
  d.created_at,
  d.updated_at,
  d.company_id
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.deleted_at IS NULL
GROUP BY d.id, d.document_number, d.document_type, d.customer_id, c.name,
         d.currency, d.issue_date, d.status, d.discount_percent, d.tax_percent,
         d.created_at, d.updated_at, d.company_id;

CREATE VIEW revenue_by_period_view AS
SELECT
  EXTRACT(YEAR FROM d.issue_date)::int AS year,
  EXTRACT(MONTH FROM d.issue_date)::int AS month,
  d.currency,
  d.document_type,
  d.company_id,
  COUNT(DISTINCT d.id) AS document_count,
  SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN COALESCE(dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
      ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
    END
    * (1 - COALESCE(d.discount_percent, 0) / 100)
    * (1 + COALESCE(d.tax_percent, 0) / 100)
  ) AS total_revenue
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.deleted_at IS NULL
  AND d.document_type = 'invoice'
  AND d.status IN ('paid', 'pending', 'partially_paid', 'overdue', 'unpaid')
GROUP BY EXTRACT(YEAR FROM d.issue_date), EXTRACT(MONTH FROM d.issue_date),
         d.currency, d.document_type, d.company_id;

CREATE VIEW outstanding_invoices_view AS
SELECT
  d.id AS document_id,
  d.document_number,
  d.customer_id,
  c.name AS customer_name,
  c.email AS customer_email,
  d.currency,
  d.issue_date,
  d.status,
  d.company_id,
  (CURRENT_DATE - d.issue_date)::int AS days_outstanding,
  SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN COALESCE(dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
      ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
    END
    * (1 - COALESCE(d.discount_percent, 0) / 100)
    * (1 + COALESCE(d.tax_percent, 0) / 100)
  ) AS amount_due,
  COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.document_id = d.id AND p.deleted_at IS NULL
  ), 0) AS amount_paid,
  SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN COALESCE(dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
      ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
    END
    * (1 - COALESCE(d.discount_percent, 0) / 100)
    * (1 + COALESCE(d.tax_percent, 0) / 100)
  ) - COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.document_id = d.id AND p.deleted_at IS NULL
  ), 0) AS balance_due
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.document_type = 'invoice'
  AND d.status IN ('pending', 'overdue', 'partially_paid', 'unpaid')
  AND d.deleted_at IS NULL
GROUP BY d.id, d.document_number, d.customer_id, c.name, c.email,
         d.currency, d.issue_date, d.status, d.company_id
HAVING SUM(
  CASE
    WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
    WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
      THEN COALESCE(dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
    ELSE COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0)
  END
  * (1 - COALESCE(d.discount_percent, 0) / 100)
  * (1 + COALESCE(d.tax_percent, 0) / 100)
) - COALESCE((
  SELECT SUM(p.amount)
  FROM payments p
  WHERE p.document_id = d.id AND p.deleted_at IS NULL
), 0) > 0;

CREATE VIEW customer_revenue_view AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  c.email AS customer_email,
  c.company_id,
  COUNT(DISTINCT dt.document_id) AS total_invoices,
  COUNT(DISTINCT CASE WHEN dt.status = 'paid' THEN dt.document_id END) AS paid_invoices,
  COUNT(DISTINCT CASE WHEN dt.status IN ('pending', 'overdue', 'partially_paid', 'unpaid') THEN dt.document_id END) AS outstanding_invoices,
  COALESCE(SUM(
    CASE WHEN dt.status IN ('paid', 'partially_paid') THEN
      (SELECT SUM(p.amount) FROM payments p
       WHERE p.document_id = dt.document_id AND p.deleted_at IS NULL)
    END
  ), 0) AS total_paid,
  COALESCE(SUM(
    CASE WHEN dt.status IN ('pending', 'overdue', 'partially_paid', 'unpaid') THEN
      dt.total_amount - COALESCE((
        SELECT SUM(p.amount)
        FROM payments p
        WHERE p.document_id = dt.document_id AND p.deleted_at IS NULL
      ), 0)
    END
  ), 0) AS total_outstanding,
  MAX(dt.issue_date) AS last_invoice_date,
  c.created_at
FROM customers c
LEFT JOIN document_totals_view dt
  ON c.id = dt.customer_id AND c.company_id = dt.company_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.email, c.company_id, c.created_at;

GRANT SELECT ON document_totals_view TO authenticated;
GRANT SELECT ON revenue_by_period_view TO authenticated;
GRANT SELECT ON outstanding_invoices_view TO authenticated;
GRANT SELECT ON customer_revenue_view TO authenticated;
