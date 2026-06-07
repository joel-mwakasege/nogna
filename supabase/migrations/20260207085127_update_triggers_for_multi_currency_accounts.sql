/*
  # Update Triggers for Multi-Currency Account Support

  ## Summary
  Updates expense and payment triggers to work with the new account_balances table
  that supports multiple currencies per account.

  ## Changes Made

  1. Functions
    - Update `handle_expense_account_deduction()` to work with account_balances
    - Create `handle_payment_account_credit()` to add payments to account_balances
    - Create `upsert_account_balance()` helper function

  2. Triggers
    - Recreate expense trigger with updated function
    - Create payment trigger for automatic balance updates

  3. Important Notes
    - Each expense/payment now updates the specific currency balance
    - Balances are created automatically if they don't exist for a currency
    - Currency code is retrieved from the expenses/payments tables
*/

-- Helper function to upsert account balance
CREATE OR REPLACE FUNCTION upsert_account_balance(
  p_account_id uuid,
  p_currency text,
  p_amount numeric
)
RETURNS void AS $$
BEGIN
  INSERT INTO account_balances (account_id, currency, balance)
  VALUES (p_account_id, p_currency, p_amount)
  ON CONFLICT (account_id, currency)
  DO UPDATE SET
    balance = account_balances.balance + p_amount,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Update function to handle expense account deduction with multi-currency support
CREATE OR REPLACE FUNCTION handle_expense_account_deduction()
RETURNS TRIGGER AS $$
DECLARE
  v_currency text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Deduct expense amount from account balance
    IF NEW.account_id IS NOT NULL THEN
      -- Get currency from the expense
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
    -- If account changed or amount changed, adjust balances
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
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Refund the account when expense is deleted
    IF OLD.account_id IS NOT NULL THEN
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

-- Create function to handle payment account credit
CREATE OR REPLACE FUNCTION handle_payment_account_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Add payment amount to account balance
    IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
      PERFORM upsert_account_balance(NEW.account_id, NEW.currency, NEW.amount);
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- If account changed or amount changed, adjust balances
    IF OLD.account_id IS DISTINCT FROM NEW.account_id OR OLD.amount <> NEW.amount OR OLD.currency IS DISTINCT FROM NEW.currency THEN
      -- Refund old account if it existed
      IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL THEN
        PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
      END IF;
      
      -- Credit new account if it exists
      IF NEW.account_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
        PERFORM upsert_account_balance(NEW.account_id, NEW.currency, NEW.amount);
      END IF;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Deduct from account when payment is deleted
    IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL THEN
      PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment account credit
DROP TRIGGER IF EXISTS trigger_payment_account_credit ON payments;
CREATE TRIGGER trigger_payment_account_credit
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_payment_account_credit();
