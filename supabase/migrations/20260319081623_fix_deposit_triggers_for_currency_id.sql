/*
  # Fix deposit account balance triggers to use currency_id

  1. Changes
    - Update handle_deposit_account_balance_insert to use currency_id
    - Update handle_deposit_account_balance_update to use currency_id
    - Update handle_deposit_account_balance_delete to use currency_id

  2. Important Notes
    - These functions were still referencing OLD/NEW.currency_code
    - Now they properly fetch the currency code from the currency_id foreign key
*/

-- Update insert trigger function
CREATE OR REPLACE FUNCTION handle_deposit_account_balance_insert()
RETURNS TRIGGER AS $$
DECLARE
  currency_code_val text;
BEGIN
  IF NEW.account_id IS NOT NULL AND NEW.currency_id IS NOT NULL THEN
    -- Get currency code from currency_id
    SELECT code INTO currency_code_val
    FROM currencies
    WHERE id = NEW.currency_id;
    
    IF currency_code_val IS NOT NULL THEN
      INSERT INTO account_balances (account_id, currency, balance)
      VALUES (NEW.account_id, currency_code_val, NEW.amount)
      ON CONFLICT (account_id, currency)
      DO UPDATE SET balance = account_balances.balance + NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update update trigger function
CREATE OR REPLACE FUNCTION handle_deposit_account_balance_update()
RETURNS TRIGGER AS $$
DECLARE
  old_currency_code text;
  new_currency_code text;
BEGIN
  -- Handle old account balance removal
  IF OLD.account_id IS NOT NULL AND OLD.currency_id IS NOT NULL THEN
    SELECT code INTO old_currency_code
    FROM currencies
    WHERE id = OLD.currency_id;
    
    IF old_currency_code IS NOT NULL THEN
      UPDATE account_balances
      SET balance = balance - OLD.amount
      WHERE account_id = OLD.account_id AND currency = old_currency_code;
      
      DELETE FROM account_balances
      WHERE account_id = OLD.account_id 
      AND currency = old_currency_code 
      AND balance = 0;
    END IF;
  END IF;
  
  -- Handle new account balance addition
  IF NEW.account_id IS NOT NULL AND NEW.currency_id IS NOT NULL THEN
    SELECT code INTO new_currency_code
    FROM currencies
    WHERE id = NEW.currency_id;
    
    IF new_currency_code IS NOT NULL THEN
      INSERT INTO account_balances (account_id, currency, balance)
      VALUES (NEW.account_id, new_currency_code, NEW.amount)
      ON CONFLICT (account_id, currency)
      DO UPDATE SET balance = account_balances.balance + NEW.amount;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update delete trigger function
CREATE OR REPLACE FUNCTION handle_deposit_account_balance_delete()
RETURNS TRIGGER AS $$
DECLARE
  currency_code_val text;
BEGIN
  IF OLD.account_id IS NOT NULL AND OLD.currency_id IS NOT NULL THEN
    SELECT code INTO currency_code_val
    FROM currencies
    WHERE id = OLD.currency_id;
    
    IF currency_code_val IS NOT NULL THEN
      UPDATE account_balances
      SET balance = balance - OLD.amount
      WHERE account_id = OLD.account_id AND currency = currency_code_val;
      
      DELETE FROM account_balances
      WHERE account_id = OLD.account_id 
      AND currency = currency_code_val 
      AND balance = 0;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
