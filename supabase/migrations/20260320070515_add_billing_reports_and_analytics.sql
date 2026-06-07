/*
  # Add Billing Reports and Analytics System

  1. New Views
    - `document_totals_view` - Calculates subtotal, tax, discount, and total for each document
    - `revenue_by_period_view` - Aggregates revenue by month and year
    - `customer_revenue_view` - Shows revenue per customer
    - `outstanding_invoices_view` - Lists unpaid invoices with amounts
    
  2. New Tables
    - `report_templates` - Stores custom report configurations
    - `saved_reports` - Stores generated report snapshots
    
  3. Security
    - Enable RLS on new tables
    - Add policies for admin access only
    
  4. Indexes
    - Add indexes for common report queries
    - Add indexes on date ranges for performance
*/

-- Create a view for document totals calculation
CREATE OR REPLACE VIEW document_totals_view AS
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
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) as subtotal,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) * (d.discount_percent / 100) as discount_amount,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) * (1 - d.discount_percent / 100) as subtotal_after_discount,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) * (1 - d.discount_percent / 100) * (d.tax_percent / 100) as tax_amount,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)), 0) * (1 - d.discount_percent / 100) * (1 + d.tax_percent / 100) as total_amount,
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

-- Create a view for revenue by period
CREATE OR REPLACE VIEW revenue_by_period_view AS
SELECT 
  EXTRACT(YEAR FROM d.issue_date) as year,
  EXTRACT(MONTH FROM d.issue_date) as month,
  d.currency,
  d.document_type,
  COUNT(d.id) as document_count,
  SUM(COALESCE(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1), 0) * (1 - d.discount_percent / 100) * (1 + d.tax_percent / 100)) as total_revenue
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE d.deleted_at IS NULL 
  AND d.document_type = 'invoice'
  AND d.status IN ('paid', 'pending')
GROUP BY EXTRACT(YEAR FROM d.issue_date), EXTRACT(MONTH FROM d.issue_date), d.currency, d.document_type
ORDER BY year DESC, month DESC;

-- Create a view for customer revenue
CREATE OR REPLACE VIEW customer_revenue_view AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  c.email as customer_email,
  COUNT(DISTINCT d.id) as total_invoices,
  COUNT(DISTINCT CASE WHEN d.status = 'paid' THEN d.id END) as paid_invoices,
  COUNT(DISTINCT CASE WHEN d.status IN ('pending', 'overdue') THEN d.id END) as outstanding_invoices,
  COALESCE(SUM(
    CASE WHEN d.status = 'paid' THEN 
      dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1) * (1 - d.discount_percent / 100) * (1 + d.tax_percent / 100)
    END
  ), 0) as total_paid,
  COALESCE(SUM(
    CASE WHEN d.status IN ('pending', 'overdue') THEN 
      dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1) * (1 - d.discount_percent / 100) * (1 + d.tax_percent / 100)
    END
  ), 0) as total_outstanding,
  MAX(d.issue_date) as last_invoice_date,
  c.created_at
FROM customers c
LEFT JOIN documents d ON c.id = d.customer_id AND d.document_type = 'invoice' AND d.deleted_at IS NULL
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.email, c.created_at;

-- Create a view for outstanding invoices
CREATE OR REPLACE VIEW outstanding_invoices_view AS
SELECT 
  d.id as document_id,
  d.document_number,
  d.customer_id,
  c.name as customer_name,
  c.email as customer_email,
  d.currency,
  d.issue_date,
  d.status,
  CURRENT_DATE - d.issue_date as days_outstanding,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1) * (1 - d.discount_percent / 100) * (1 + d.tax_percent / 100)), 0) as amount_due,
  COALESCE(SUM(p.amount), 0) as amount_paid,
  COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1) * (1 - d.discount_percent / 100) * (1 + d.tax_percent / 100)), 0) - COALESCE(SUM(p.amount), 0) as balance_due
FROM documents d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN document_line_items dli ON ds.id = dli.section_id
LEFT JOIN payments p ON d.id = p.document_id AND p.deleted_at IS NULL
WHERE d.document_type = 'invoice' 
  AND d.status IN ('pending', 'overdue')
  AND d.deleted_at IS NULL
GROUP BY d.id, d.document_number, d.customer_id, c.name, c.email, d.currency, d.issue_date, d.status
HAVING COALESCE(SUM(dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1) * (1 - d.discount_percent / 100) * (1 + d.tax_percent / 100)), 0) - COALESCE(SUM(p.amount), 0) > 0
ORDER BY days_outstanding DESC;

-- Create report_templates table for custom report configurations
CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  report_type text NOT NULL CHECK (report_type IN ('revenue', 'expenses', 'profit_loss', 'customer', 'outstanding', 'custom')),
  configuration jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create saved_reports table for storing report snapshots
CREATE TABLE IF NOT EXISTS saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES report_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  report_data jsonb NOT NULL,
  date_from date,
  date_to date,
  currency text,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for report_templates (admin only)
CREATE POLICY "Admins can view all report templates"
  ON report_templates FOR SELECT
  TO authenticated
  USING ((SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can insert report templates"
  ON report_templates FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can update report templates"
  ON report_templates FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin(auth.uid())))
  WITH CHECK ((SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can delete report templates"
  ON report_templates FOR DELETE
  TO authenticated
  USING ((SELECT is_admin(auth.uid())));

-- Create policies for saved_reports (admin only)
CREATE POLICY "Admins can view all saved reports"
  ON saved_reports FOR SELECT
  TO authenticated
  USING ((SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can insert saved reports"
  ON saved_reports FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can delete saved reports"
  ON saved_reports FOR DELETE
  TO authenticated
  USING ((SELECT is_admin(auth.uid())));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_issue_date ON documents(issue_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_customer_type ON documents(customer_id, document_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type_status ON documents(document_type, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_document_id ON payments(document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deposits_date ON deposits(deposit_date) WHERE deleted_at IS NULL;

-- Insert default system report templates
INSERT INTO report_templates (name, description, report_type, is_system, configuration) VALUES
  ('Monthly Revenue Report', 'Shows total revenue by month with breakdown by currency', 'revenue', true, 
   '{"groupBy": "month", "metrics": ["total_revenue", "document_count"], "filters": {"document_type": "invoice", "status": ["paid", "pending"]}}'),
  
  ('Customer Revenue Summary', 'Displays revenue by customer with payment status', 'customer', true,
   '{"metrics": ["total_paid", "total_outstanding", "total_invoices"], "sortBy": "total_paid", "sortOrder": "desc"}'),
  
  ('Outstanding Invoices', 'Lists all unpaid invoices with aging information', 'outstanding', true,
   '{"filters": {"status": ["pending", "overdue"]}, "sortBy": "days_outstanding", "sortOrder": "desc"}'),
  
  ('Profit & Loss Statement', 'Shows revenue vs expenses with net profit calculation', 'profit_loss', true,
   '{"metrics": ["total_revenue", "total_expenses", "net_profit"], "groupBy": "month"}')
ON CONFLICT DO NOTHING;
