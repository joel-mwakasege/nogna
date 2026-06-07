/*
  # Fix Expense Soft Delete Balance Handling

  1. Updates
    - Add triggers to handle soft delete for expenses
    - When an expense is moved to trash (deleted_at is set), refund the amount to the account
    - When an expense is restored from trash (deleted_at is cleared), deduct the amount again

  2. Trigger Functions
    - Update `handle_expense_account_deduction` to check deleted_at status
    - Add specific handling for soft delete transitions

  3. Important Notes
    - Expenses that are soft-deleted should have their amount refunded to the account
    - Expenses that are restored should have their amount deducted again
    - This ensures account balances are accurate whether expenses are active or trashed
*/

-- Update function to handle expense soft deletes
CREATE OR REPLACE FUNCTION handle_expense_account_deduction()
RETURNS TRIGGER AS $$
DECLARE
  v_currency text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only deduct if not already deleted
    IF NEW.account_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
      SELECT c.code INTO v_currency
      FROM expenses e
      JOIN currencies c ON e.currency_id = c.id
      WHERE e.id = NEW.id;
      
      IF v_currency IS NOT NULL THEN
        PERFORM upsert_account_balance(NEW.account_id, v_currency, -NEW.amount);
      END IF;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle soft delete: when deleted_at changes from NULL to NOT NULL
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      -- Refund the amount (expense is being soft deleted)
      IF OLD.account_id IS NOT NULL THEN
        SELECT c.code INTO v_currency
        FROM currencies c
        WHERE c.id = OLD.currency_id;
        
        IF v_currency IS NOT NULL THEN
          PERFORM upsert_account_balance(OLD.account_id, v_currency, OLD.amount);
        END IF;
      END IF;
      RETURN NEW;
    END IF;
    
    -- Handle restore from trash: when deleted_at changes from NOT NULL to NULL
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      -- Deduct the amount again (expense is being restored)
      IF NEW.account_id IS NOT NULL THEN
        SELECT c.code INTO v_currency
        FROM currencies c
        WHERE c.id = NEW.currency_id;
        
        IF v_currency IS NOT NULL THEN
          PERFORM upsert_account_balance(NEW.account_id, v_currency, -NEW.amount);
        END IF;
      END IF;
      RETURN NEW;
    END IF;
    
    -- Handle regular updates (only if not deleted)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL THEN
      IF OLD.account_id IS DISTINCT FROM NEW.account_id OR OLD.amount <> NEW.amount OR OLD.currency_id IS DISTINCT FROM NEW.currency_id THEN
        -- Refund old account if it existed
        IF OLD.account_id IS NOT NULL THEN
          SELECT c.code INTO v_currency
          FROM currencies c
          WHERE c.id = OLD.currency_id;
          
          IF v_currency IS NOT NULL THEN
            PERFORM upsert_account_balance(OLD.account_id, v_currency, OLD.amount);
          END IF;
        END IF;
        
        -- Deduct from new account if it exists
        IF NEW.account_id IS NOT NULL THEN
          SELECT c.code INTO v_currency
          FROM currencies c
          WHERE c.id = NEW.currency_id;
          
          IF v_currency IS NOT NULL THEN
            PERFORM upsert_account_balance(NEW.account_id, v_currency, -NEW.amount);
          END IF;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Only refund if the expense was active (not soft deleted)
    IF OLD.account_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
      SELECT c.code INTO v_currency
      FROM currencies c
      WHERE c.id = OLD.currency_id;
      
      IF v_currency IS NOT NULL THEN
        PERFORM upsert_account_balance(OLD.account_id, v_currency, OLD.amount);
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for expense account deduction
DROP TRIGGER IF EXISTS trigger_expense_account_deduction ON expenses;
CREATE TRIGGER trigger_expense_account_deduction
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION handle_expense_account_deduction();