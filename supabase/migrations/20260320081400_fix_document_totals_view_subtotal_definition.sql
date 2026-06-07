/*
  # Fix Document Totals View Subtotal Definition

  ## Summary
  The subtotal field in document_totals_view was showing the raw line items total
  instead of the subtotal after discount (which is the standard meaning of "subtotal").
  
  ## Changes Made
  
  1. View Column Definitions
    - `line_items_total` - Raw sum of all line items (before discount/tax)
    - `subtotal` - Amount after discount but before tax (standard definition)
    - `discount_amount` - Total discount applied
    - `tax_amount` - Tax on the subtotal
    - `total_amount` - Final amount including tax
    
  2. Logic Updates
    - Renamed old "subtotal" to line_items_total for clarity
    - Made "subtotal" represent the amount after discount (before tax)
    - This matches standard invoicing terminology
    
  3. Important Notes
    - Standard invoice flow: Line Items Total → Discount → Subtotal → Tax → Total
    - This fix ensures reports show the correct subtotal value
*/

-- Drop and recreate document_totals_view with correct subtotal definition
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
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) as line_items_total,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) * (COALESCE(d.discount_percent, 0) / 100) as discount_amount,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) as subtotal,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) * (COALESCE(d.tax_percent, 0) / 100) as tax_amount,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) * (1 - COALESCE(d.discount_percent, 0) / 100) * (1 + COALESCE(d.tax_percent, 0) / 100) as total_amount,
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
