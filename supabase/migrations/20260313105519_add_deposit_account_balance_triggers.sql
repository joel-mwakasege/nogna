/*
  # Add Deposit Account Balance Triggers

  1. Updates
    - Modify account balance triggers to handle deposits
    - Deposits increase account balance (opposite of expenses which decrease it)
    - Ensure proper multi-currency support for deposits
  
  2. Trigger Functions
    - `handle_deposit_account_balance_insert` - Increases balance when deposit is created
    - `handle_deposit_account_balance_update` - Updates balance when deposit is modified
    - `handle_deposit_account_balance_delete` - Decreases balance when deposit is deleted
  
  3. Important Notes
    - Deposits add to account balance, expenses subtract
    - Supports multi-currency deposits
    - Automatically creates account_balances record if doesn't exist
    - Updates balance in the currency of the deposit
*/

-- Function to handle deposit insert (increases account balance)
CREATE OR REPLACE FUNCTION handle_deposit_account_balance_insert()
RETURNS TRIGGER AS $$
DECLARE
  currency_from_id text;
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    SELECT code INTO currency_from_id
    FROM currencies
    WHERE id = (SELECT currency_id FROM deposits WHERE id = NEW.id);
    
    IF currency_from_id IS NULL THEN
      currency_from_id := NEW.currency_code;
    END IF;

    INSERT INTO account_balances (account_id, currency, balance)
    VALUES (NEW.account_id, NEW.currency_code, NEW.amount)
    ON CONFLICT (account_id, currency)
    DO UPDATE SET balance = account_balances.balance + NEW.amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle deposit update (adjusts balance difference)
CREATE OR REPLACE FUNCTION handle_deposit_account_balance_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.account_id IS NOT NULL THEN
    UPDATE account_balances
    SET balance = balance - OLD.amount
    WHERE account_id = OLD.account_id AND currency = OLD.currency_code;

    DELETE FROM account_balances
    WHERE account_id = OLD.account_id 
      AND currency = OLD.currency_code 
      AND balance = 0;
  END IF;

  IF NEW.account_id IS NOT NULL THEN
    INSERT INTO account_balances (account_id, currency, balance)
    VALUES (NEW.account_id, NEW.currency_code, NEW.amount)
    ON CONFLICT (account_id, currency)
    DO UPDATE SET balance = account_balances.balance + NEW.amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle deposit delete (decreases account balance)
CREATE OR REPLACE FUNCTION handle_deposit_account_balance_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.account_id IS NOT NULL THEN
    UPDATE account_balances
    SET balance = balance - OLD.amount
    WHERE account_id = OLD.account_id AND currency = OLD.currency_code;

    DELETE FROM account_balances
    WHERE account_id = OLD.account_id 
      AND currency = OLD.currency_code 
      AND balance = 0;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for deposits
DROP TRIGGER IF EXISTS deposit_account_balance_insert ON deposits;
CREATE TRIGGER deposit_account_balance_insert
  AFTER INSERT ON deposits
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION handle_deposit_account_balance_insert();

DROP TRIGGER IF EXISTS deposit_account_balance_update ON deposits;
CREATE TRIGGER deposit_account_balance_update
  AFTER UPDATE ON deposits
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION handle_deposit_account_balance_update();

DROP TRIGGER IF EXISTS deposit_account_balance_delete ON deposits;
CREATE TRIGGER deposit_account_balance_delete
  AFTER DELETE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION handle_deposit_account_balance_delete();

-- Handle soft delete (when deleted_at is set)
DROP TRIGGER IF EXISTS deposit_account_balance_soft_delete ON deposits;
CREATE TRIGGER deposit_account_balance_soft_delete
  AFTER UPDATE ON deposits
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION handle_deposit_account_balance_delete();