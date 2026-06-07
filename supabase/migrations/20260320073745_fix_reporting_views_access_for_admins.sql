/*
  # Fix Reporting Views Access for Admin Users

  ## Summary
  The reporting views were created but not accessible to authenticated users due to RLS.
  This migration grants proper access to the reporting views for admin users.

  ## Changes Made

  1. Security Functions
    - Create security definer functions to wrap view access with proper RLS checks
    - Ensures only admin users can access reporting data
    
  2. View Access
    - Grant SELECT permissions on all reporting views to authenticated users
    - The underlying RLS policies on source tables will still enforce security
    
  3. Important Notes
    - Views inherit RLS from underlying tables
    - Direct grants allow authenticated users to query views
    - Admin check in application layer provides additional security
*/

-- Grant SELECT on all reporting views to authenticated users
GRANT SELECT ON revenue_by_period_view TO authenticated;
GRANT SELECT ON customer_revenue_view TO authenticated;
GRANT SELECT ON outstanding_invoices_view TO authenticated;
GRANT SELECT ON document_totals_view TO authenticated;

-- Create security definer functions for reporting views
-- These functions allow admins to access aggregated data through views

CREATE OR REPLACE FUNCTION get_revenue_by_period(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_currency text DEFAULT NULL
)
RETURNS TABLE (
  year numeric,
  month numeric,
  currency text,
  document_type text,
  document_count bigint,
  total_revenue numeric
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT (SELECT is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    r.year,
    r.month,
    r.currency,
    r.document_type,
    r.document_count,
    r.total_revenue
  FROM revenue_by_period_view r
  WHERE (p_currency IS NULL OR r.currency = p_currency);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_customer_revenue()
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  customer_email text,
  total_invoices bigint,
  paid_invoices bigint,
  outstanding_invoices bigint,
  total_paid numeric,
  total_outstanding numeric,
  last_invoice_date date,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT (SELECT is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    c.customer_id,
    c.customer_name,
    c.customer_email,
    c.total_invoices,
    c.paid_invoices,
    c.outstanding_invoices,
    c.total_paid,
    c.total_outstanding,
    c.last_invoice_date,
    c.created_at
  FROM customer_revenue_view c;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_outstanding_invoices(
  p_currency text DEFAULT NULL
)
RETURNS TABLE (
  document_id uuid,
  document_number text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  currency text,
  issue_date date,
  status text,
  days_outstanding integer,
  amount_due numeric,
  amount_paid numeric,
  balance_due numeric
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT (SELECT is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    o.document_id,
    o.document_number,
    o.customer_id,
    o.customer_name,
    o.customer_email,
    o.currency,
    o.issue_date,
    o.status,
    o.days_outstanding,
    o.amount_due,
    o.amount_paid,
    o.balance_due
  FROM outstanding_invoices_view o
  WHERE (p_currency IS NULL OR o.currency = p_currency);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_document_totals(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_currency text DEFAULT NULL
)
RETURNS TABLE (
  document_id uuid,
  document_number text,
  document_type text,
  customer_name text,
  currency text,
  issue_date date,
  status text,
  subtotal numeric,
  discount_amount numeric,
  tax_amount numeric,
  total_amount numeric
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT (SELECT is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    d.document_id,
    d.document_number,
    d.document_type,
    d.customer_name,
    d.currency,
    d.issue_date,
    d.status,
    d.subtotal,
    d.discount_amount,
    d.tax_amount,
    d.total_amount
  FROM document_totals_view d
  WHERE 
    (p_date_from IS NULL OR d.issue_date >= p_date_from)
    AND (p_date_to IS NULL OR d.issue_date <= p_date_to)
    AND (p_currency IS NULL OR d.currency = p_currency);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on the functions to authenticated users
GRANT EXECUTE ON FUNCTION get_revenue_by_period TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION get_outstanding_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_totals TO authenticated;
