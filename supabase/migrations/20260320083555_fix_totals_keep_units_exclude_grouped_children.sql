/*
  # Fix Document Totals - Correct Calculation with Grouped Items
  
  ## Summary
  The document totals calculation needs to:
  1. Use the formula: units × days × unit_cost × units_multiplier
  2. BUT exclude grouped child items (where group_id IS NOT NULL AND is_group_parent = false)
  
  ## Important Notes
  
  - For regular items: unit_cost is price per unit, so multiply by units and days
  - For grouped items: only the parent item (is_group_parent=true) counts
  - Child items in a group are for display only and should not be included in totals
  
  ## Example from Quote-12
  
  Video Section:
  - "Video Equipments" (parent, 1 × 1 × $1000) = $1000 ✓
  - "Camera Operator" (child, grouped) = excluded ✗
  - "AV technician" (standalone, 1 × 1 × $100) = $100 ✓
  - "Ushers" (standalone, 4 × 1 × $60) = $240 ✓
  
  Lighting Section:
  - "Ambiance Lighting" (15 × 1 × $20) = $300 ✓
  - "T Stands" (2 × 1 × $120) = $240 ✓
*/

-- Drop and recreate document_totals_view with correct calculation
DROP VIEW IF EXISTS document_totals_view;

CREATE VIEW document_totals_view AS
SELECT 
  d.id as document_id,
  d.document_number,
  d.document_type,
  d.customer_id,
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
  ), 0) as line_items_total,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (COALESCE(d.discount_percent, 0) / 100) as discount_amount,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) as subtotal,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) * (COALESCE(d.tax_percent, 0) / 100) as tax_amount,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) * (1 + COALESCE(d.tax_percent, 0) / 100) as total_amount,
  d.created_at,
  d.updated_at
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.deleted_at IS NULL
GROUP BY d.id, d.document_number, d.document_type, d.customer_id, c.name, 
         d.currency, d.issue_date, d.status, d.discount_percent, d.tax_percent,
         d.created_at, d.updated_at;

-- Re-grant access to the view
GRANT SELECT ON document_totals_view TO authenticated;
