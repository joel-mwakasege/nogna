/*
  # Fix handle_payment_account_credit trigger function security

  ## Problem
  When a document is soft-deleted, the cascade trigger (SECURITY DEFINER) updates
  payments, which fires handle_payment_account_credit. This function is NOT SECURITY
  DEFINER, so auth.uid() returns NULL in that trigger chain, causing the account_balances
  RLS policies to block the balance update — making invoice deletion hang forever.

  ## Fix
  Recreate handle_payment_account_credit as SECURITY DEFINER so it can update
  account_balances regardless of the auth context, consistent with upsert_account_balance.
*/

CREATE OR REPLACE FUNCTION handle_payment_account_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL AND NEW.deleted_at IS NULL THEN
      PERFORM upsert_account_balance(NEW.account_id, NEW.currency, NEW.amount);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle soft delete: when deleted_at changes from NULL to NOT NULL
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL THEN
        PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
      END IF;
      RETURN NEW;
    END IF;

    -- Handle restore from trash: when deleted_at changes from NOT NULL to NULL
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
        PERFORM upsert_account_balance(NEW.account_id, NEW.currency, NEW.amount);
      END IF;
      RETURN NEW;
    END IF;

    -- Handle regular updates (only if not deleted)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL THEN
      IF OLD.account_id IS DISTINCT FROM NEW.account_id OR OLD.amount <> NEW.amount OR OLD.currency IS DISTINCT FROM NEW.currency THEN
        IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL THEN
          PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
        END IF;
        IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
          PERFORM upsert_account_balance(NEW.account_id, NEW.currency, NEW.amount);
        END IF;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL AND OLD.deleted_at IS NULL THEN
      PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;
