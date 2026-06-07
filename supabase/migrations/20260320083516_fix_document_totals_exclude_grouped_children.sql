/*
  # Fix Document Totals - Exclude Grouped Child Items
  
  ## Summary
  The document totals were incorrectly including grouped child items in calculations.
  When line items are grouped, only the parent item (is_group_parent=true) should 
  contribute to the total. Child items (group_id IS NOT NULL AND is_group_parent=false) 
  are for display purposes only.
  
  ## Changes Made
  
  1. View Calculation Fix
    - Exclude line items where `group_id IS NOT NULL AND is_group_parent = false`
    - Only count:
      - Standalone items (group_id IS NULL)
      - Group parent items (is_group_parent = true)
    
  2. Example from Quote-12 Video Section
    - "Video Equipments" (parent, $1000) ✓ counts
    - "Camera Operator" (child, grouped) ✗ excluded
    - "Intercom Headsets" (child, grouped) ✗ excluded
    - "AV technician" (standalone, $100) ✓ counts
*/

-- Drop and recreate document_totals_view excluding grouped child items
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
      ELSE dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) as line_items_total,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (COALESCE(d.discount_percent, 0) / 100) as discount_amount,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) as subtotal,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)
    END
  ), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) * (COALESCE(d.tax_percent, 0) / 100) as tax_amount,
  COALESCE(SUM(
    CASE 
      WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
      ELSE dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)
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
