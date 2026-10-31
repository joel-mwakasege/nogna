/*
  # Align report totals with invoice grouped-item calculation

  Safe replacement of document_totals_view.

  Group calculation matches the invoice UI:
  - grouped child: excluded
  - grouped parent: days * unit_cost
  - ordinary item: units * days * unit_cost
  - section units_multiplier applies to each calculation

  CREATE OR REPLACE preserves dependent views such as
  net_vat_by_period_view and saas_company_resource_usage.
*/

CREATE OR REPLACE VIEW public.document_totals_view AS
SELECT
  d.id AS document_id,
  d.document_number,
  d.document_type,
  d.customer_id,
  d.company_id,
  c.name AS customer_name,
  d.currency,
  d.issue_date,
  d.status,
  d.discount_percent,
  d.tax_percent,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0::numeric
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
    END
  ), 0::numeric) AS subtotal,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0::numeric
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
    END
  ), 0::numeric) * (d.discount_percent / 100::numeric) AS discount_amount,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0::numeric
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
    END
  ), 0::numeric) * (1::numeric - d.discount_percent / 100::numeric) AS subtotal_after_discount,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0::numeric
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
    END
  ), 0::numeric) * (1::numeric - d.discount_percent / 100::numeric)
    * (d.tax_percent / 100::numeric) AS tax_amount,
  COALESCE(SUM(
    CASE
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0::numeric
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = true
        THEN dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1::numeric)
    END
  ), 0::numeric) * (1::numeric - d.discount_percent / 100::numeric)
    * (1::numeric + d.tax_percent / 100::numeric) AS total_amount,
  d.created_at,
  d.updated_at
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.deleted_at IS NULL
GROUP BY
  d.id,
  d.document_number,
  d.document_type,
  d.customer_id,
  d.company_id,
  c.name,
  d.currency,
  d.issue_date,
  d.status,
  d.discount_percent,
  d.tax_percent,
  d.created_at,
  d.updated_at;
