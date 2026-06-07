/*
  # Auto-cleanup Zero Balances in Account Balances Table

  ## Summary
  Updates the upsert_account_balance function to automatically delete balance records
  when they reach zero. This ensures accounts only show currencies with active balances.

  ## Changes Made
  1. Update upsert_account_balance() function to:
     - Calculate the new balance after the operation
     - Delete the record if the balance becomes zero
     - Otherwise, update or insert as before

  ## Benefits
  - Keeps account_balances table clean
  - Only shows active currencies in account details
  - Automatically handles cleanup when all transactions are deleted
*/

CREATE OR REPLACE FUNCTION upsert_account_balance(
  p_account_id uuid,
  p_currency text,
  p_amount numeric
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;