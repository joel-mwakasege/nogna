/*
  # Fix Payment Account Balance to Credit (Add) Instead of Debit

  ## Summary
  The payment trigger was incorrectly deducting payment amounts from bank accounts.
  When a payment is received for an invoice, the bank account balance should INCREASE.

  ## Changes Made

  1. Function Updates
    - `handle_payment_account_credit()`: Change logic to ADD payment amounts to accounts
    - INSERT: Add payment amount (use +NEW.amount instead of -NEW.amount)
    - UPDATE (soft delete): Deduct when deleted (use -OLD.amount instead of +OLD.amount)
    - UPDATE (restore): Add back when restored (use +NEW.amount instead of -NEW.amount)
    - DELETE: Deduct when permanently deleted (use -OLD.amount instead of +OLD.amount)

  ## Rationale
  - Payments represent money RECEIVED from customers
  - Receiving money should INCREASE the bank account balance
  - Previous logic was treating payments as outgoing transactions (like expenses)
  - This fix aligns payment behavior with standard accounting practices
*/

CREATE OR REPLACE FUNCTION handle_payment_account_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Add payment amount to account (payment increases balance)
    IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL AND NEW.deleted_at IS NULL THEN
      PERFORM upsert_account_balance(NEW.account_id, NEW.currency, NEW.amount);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle soft delete: when deleted_at changes from NULL to NOT NULL
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      -- Remove the payment amount from account (payment is being soft deleted)
      IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL THEN
        PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
      END IF;
      RETURN NEW;
    END IF;

    -- Handle restore from trash: when deleted_at changes from NOT NULL to NULL
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      -- Add the payment amount to account (payment is being restored)
      IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
        PERFORM upsert_account_balance(NEW.account_id, NEW.currency, NEW.amount);
      END IF;
      RETURN NEW;
    END IF;

    -- Handle regular updates (only if not deleted)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL THEN
      IF OLD.account_id IS DISTINCT FROM NEW.account_id OR OLD.amount <> NEW.amount OR OLD.currency IS DISTINCT FROM NEW.currency THEN
        -- Remove from old account if it existed
        IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL THEN
          PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
        END IF;

        -- Add to new account if it exists
        IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
          PERFORM upsert_account_balance(NEW.account_id, NEW.currency, NEW.amount);
        END IF;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Remove payment amount if the payment was active (not soft deleted)
    IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL AND OLD.deleted_at IS NULL THEN
      PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
