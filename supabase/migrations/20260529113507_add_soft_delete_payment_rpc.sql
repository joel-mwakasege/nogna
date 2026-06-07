/*
  # Add soft_delete_payment RPC function

  ## Problem
  PostgRES wraps UPDATE in a RETURNING * CTE that is then filtered by the SELECT policy.
  The SELECT policy on payments requires deleted_at IS NULL. After soft-deleting a payment,
  the row is no longer visible through the SELECT policy, so PostgRES sees 0 rows returned
  and raises an error — even though the UPDATE succeeded.

  ## Fix
  A SECURITY DEFINER function runs as postgres (superuser), bypassing the PostgRES
  RETURNING/SELECT-policy conflict entirely. The function performs its own authorization
  check before proceeding, so security is maintained.

  ## New Functions
  - `soft_delete_payment(payment_id uuid)` — verifies the caller's company_id matches
    the payment's company_id, then sets deleted_at = now(). Returns true on success,
    raises an exception if unauthorized or not found.
*/

CREATE OR REPLACE FUNCTION soft_delete_payment(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_caller_company_id uuid;
BEGIN
  -- Get the payment's company_id
  SELECT company_id INTO v_company_id
  FROM payments
  WHERE id = p_payment_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or already deleted';
  END IF;

  -- Get the caller's company_id
  SELECT company_id INTO v_caller_company_id
  FROM user_profiles
  WHERE id = auth.uid();

  IF v_caller_company_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no company associated with user';
  END IF;

  -- Ensure caller belongs to the same company as the payment
  IF v_company_id IS DISTINCT FROM v_caller_company_id THEN
    -- Allow SAAS admins to delete any payment
    IF NOT EXISTS (SELECT 1 FROM saas_admins WHERE user_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: payment does not belong to your company';
    END IF;
  END IF;

  -- Perform the soft delete
  UPDATE payments
  SET deleted_at = now()
  WHERE id = p_payment_id;

  RETURN true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete_payment(uuid) TO authenticated;
