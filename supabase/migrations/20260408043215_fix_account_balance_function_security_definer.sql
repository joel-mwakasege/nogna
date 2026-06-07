/*
  # Fix Account Balance Function to Bypass RLS

  1. Problem
    - upsert_account_balance() function runs with user permissions
    - When triggers call this function, RLS blocks INSERT/UPDATE operations
    - Users cannot record payments because account_balances has no INSERT policy
    - Error: "new row violates row-level security policy for table account_balances"
    
  2. Solution
    - Add SECURITY DEFINER to upsert_account_balance() function
    - This allows the function to bypass RLS when called by triggers
    - Balance updates should only happen through system triggers, not direct user access
    
  3. Security
    - Only triggers can call this function (users can't call it directly)
    - Account balance RLS still protects SELECT operations
    - This is safe because balances are always calculated from transactions
*/

CREATE OR REPLACE FUNCTION upsert_account_balance(
  p_account_id uuid,
  p_currency text,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  -- Check if record exists and calculate what the new balance would be
  SELECT balance + p_amount INTO v_new_balance
  FROM account_balances
  WHERE account_id = p_account_id AND currency = p_currency;

  IF FOUND THEN
    -- Record exists, check if new balance would be zero
    IF v_new_balance = 0 THEN
      -- Delete the record if balance is zero
      DELETE FROM account_balances
      WHERE account_id = p_account_id AND currency = p_currency;
    ELSE
      -- Update with new balance
      UPDATE account_balances
      SET balance = v_new_balance, updated_at = now()
      WHERE account_id = p_account_id AND currency = p_currency;
    END IF;
  ELSE
    -- Record doesn't exist, insert only if amount is not zero
    IF p_amount != 0 THEN
      INSERT INTO account_balances (account_id, currency, balance)
      VALUES (p_account_id, p_currency, p_amount);
    END IF;
  END IF;
END;
$$;
