/*
  # Add Payment Status Sync Trigger

  ## Summary
  Adds a database-level trigger that automatically recalculates and writes the
  correct invoice status whenever a payment row is inserted, updated, or soft-deleted.
  This ensures the document status is always accurate in the database regardless of
  frontend state.

  ## Problem
  Previously, invoice status recalculation only happened inside the React component.
  If a payment was deleted (soft-deleted) and the frontend state was stale, the status
  comparison guard could silently skip the update, leaving the invoice showing 'paid'
  even after payments were removed or reduced.

  ## Changes

  1. **New function `recalculate_document_status(p_document_id uuid)`**
     - Queries all non-deleted payments for the invoice
     - Sums actual payment amounts
     - Calculates the invoice total from line items (respecting groups, discount, tax)
     - Writes the correct status: 'unpaid', 'partially_paid', or 'paid'
     - Only fires the UPDATE if the status actually needs to change (avoids noise)

  2. **New trigger `trg_payment_status_sync` on `payments` table**
     - Fires AFTER INSERT, UPDATE, DELETE
     - Calls `recalculate_document_status` for the affected document
     - Handles both hard deletes (DELETE) and soft deletes (UPDATE setting deleted_at)

  ## Security
  - Function uses SECURITY DEFINER so it can update documents regardless of RLS
  - search_path locked to public to prevent search path injection
*/

-- Function to recalculate and write document status based on current payments
CREATE OR REPLACE FUNCTION recalculate_document_status(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid      numeric;
  v_invoice_total   numeric;
  v_current_status  text;
  v_new_status      text;
BEGIN
  -- Only process invoices that exist and are not deleted
  SELECT status INTO v_current_status
  FROM documents
  WHERE id = p_document_id
    AND deleted_at IS NULL
    AND document_type = 'invoice';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Sum all non-deleted payments for this document
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM payments
  WHERE document_id = p_document_id
    AND deleted_at IS NULL;

  -- Calculate invoice total from line items (mirrors frontend calculation)
  SELECT COALESCE(
    SUM(
      CASE
        WHEN dli.group_id IS NOT NULL AND dli.is_group_parent = false THEN 0
        ELSE dli.units * dli.days * dli.unit_cost * COALESCE(ds.units_multiplier, 1)
      END
    ) * (1 - COALESCE(d.discount_percent, 0) / 100)
      * (1 + COALESCE(d.tax_percent, 0) / 100),
    0
  )
  INTO v_invoice_total
  FROM documents d
  LEFT JOIN document_sections ds ON ds.document_id = d.id
  LEFT JOIN document_line_items dli ON dli.section_id = ds.id
  WHERE d.id = p_document_id
    AND d.deleted_at IS NULL;

  -- Determine correct status
  IF v_total_paid <= 0 THEN
    v_new_status := 'unpaid';
  ELSIF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  -- Only write if status needs to change
  IF v_new_status IS DISTINCT FROM v_current_status THEN
    UPDATE documents
    SET status = v_new_status,
        updated_at = now()
    WHERE id = p_document_id;
  END IF;
END;
$$;

-- Trigger function that routes to recalculate_document_status
CREATE OR REPLACE FUNCTION trg_payment_status_sync_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_document_status(OLD.document_id);
  ELSE
    -- INSERT or UPDATE (including soft-deletes)
    PERFORM recalculate_document_status(NEW.document_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Drop existing trigger if present (idempotent)
DROP TRIGGER IF EXISTS trg_payment_status_sync ON payments;

-- Create the trigger
CREATE TRIGGER trg_payment_status_sync
  AFTER INSERT OR UPDATE OR DELETE
  ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trg_payment_status_sync_fn();

-- Grant execute on helper function to authenticated users (called via trigger, but explicit is cleaner)
GRANT EXECUTE ON FUNCTION recalculate_document_status(uuid) TO authenticated;
