/*
  # Fix Payment Account Balance Logic

  1. Changes
    - Update `handle_payment_account_credit` function to correctly deduct payment amounts from accounts
    - Payments should REDUCE account balances (debits), not increase them (credits)
    - Changes:
      - INSERT: Deduct payment amount from account balance (use -NEW.amount)
      - UPDATE (soft delete): Add back payment amount when deleted (use +OLD.amount)
      - UPDATE (restore): Deduct payment amount when restored (use -NEW.amount)
      - UPDATE (regular): Properly handle deductions
      - DELETE: Add back payment amount to account (use +OLD.amount)
  
  2. Security
    - No RLS changes, only fixing trigger logic
*/

CREATE OR REPLACE FUNCTION handle_payment_account_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Deduct payment amount from account (payment reduces balance)
    IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL AND NEW.deleted_at IS NULL THEN
      PERFORM upsert_account_balance(NEW.account_id, NEW.currency, -NEW.amount);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle soft delete: when deleted_at changes from NULL to NOT NULL
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      -- Add back the payment amount to account (payment is being soft deleted)
      IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL THEN
        PERFORM upsert_account_balance(OLD.account_id, OLD.currency, OLD.amount);
      END IF;
      RETURN NEW;
    END IF;

    -- Handle restore from trash: when deleted_at changes from NOT NULL to NULL
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      -- Deduct the payment amount from account (payment is being restored)
      IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
        PERFORM upsert_account_balance(NEW.account_id, NEW.currency, -NEW.amount);
      END IF;
      RETURN NEW;
    END IF;

    -- Handle regular updates (only if not deleted)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL THEN
      IF OLD.account_id IS DISTINCT FROM NEW.account_id OR OLD.amount <> NEW.amount OR OLD.currency IS DISTINCT FROM NEW.currency THEN
        -- Add back to old account if it existed
        IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL THEN
          PERFORM upsert_account_balance(OLD.account_id, OLD.currency, OLD.amount);
        END IF;

        -- Deduct from new account if it exists
        IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
          PERFORM upsert_account_balance(NEW.account_id, NEW.currency, -NEW.amount);
        END IF;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Add back payment amount if the payment was active (not soft deleted)
    IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL AND OLD.deleted_at IS NULL THEN
      PERFORM upsert_account_balance(OLD.account_id, OLD.currency, OLD.amount);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
