/*
  # Fix Line Item Calculation - Unit Cost is Total Price
  
  ## Summary
  The document totals calculation was incorrect. The `unit_cost` field in 
  `document_line_items` stores the **total price for all units**, not the 
  price per unit.
  
  ## Changes Made
  
  1. View Calculation Fix
    - Changed from: `units * days * unit_cost * units_multiplier`
    - Changed to: `unit_cost * days * units_multiplier`
    - The `units` field is for display only (e.g., "3 Camera Operators")
    - The `unit_cost` already contains the combined price for all units
    
  2. Important Notes
    - This fixes the inflated totals where line items were being multiplied by units incorrectly
    - For example: "Camera Operator" with units=3 and unit_cost=$1000 should show $1000 total, not $3000
*/

-- Drop and recreate document_totals_view with correct line item calculation
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
  COALESCE(SUM(dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)), 0) as line_items_total,
  COALESCE(SUM(dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)), 0) * (COALESCE(d.discount_percent, 0) / 100) as discount_amount,
  COALESCE(SUM(dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) as subtotal,
  COALESCE(SUM(dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) * (COALESCE(d.tax_percent, 0) / 100) as tax_amount,
  COALESCE(SUM(dli.unit_cost * dli.days * COALESCE(ds.units_multiplier, 1)), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) * (1 + COALESCE(d.tax_percent, 0) / 100) as total_amount,
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
