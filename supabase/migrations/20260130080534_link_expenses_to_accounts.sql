/*
  # Link Expenses to Bank Accounts

  1. Changes to expenses table
    - Add `account_id` (uuid, references accounts table)
    - Add index for account_id for better query performance

  2. Function to update account balance
    - Creates a function that updates account balance when expense is created/updated/deleted
    - Handles negative balances (allows overdraft)

  3. Triggers
    - Trigger on expense insert to deduct from account
    - Trigger on expense update to adjust account balance
    - Trigger on expense delete to refund to account

  4. Security
    - Update RLS policies to ensure users can only link expenses to accounts they have access to
*/

-- Add account_id to expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id);

-- Function to update account balance when expense is created
CREATE OR REPLACE FUNCTION handle_expense_account_deduction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Deduct expense amount from account balance
    IF NEW.account_id IS NOT NULL THEN
      UPDATE accounts
      SET balance = balance - NEW.amount,
          updated_at = now()
      WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If account changed or amount changed, adjust balances
    IF OLD.account_id IS DISTINCT FROM NEW.account_id OR OLD.amount <> NEW.amount THEN
      -- Refund old account if it existed
      IF OLD.account_id IS NOT NULL THEN
        UPDATE accounts
        SET balance = balance + OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      END IF;
      -- Deduct from new account if it exists
      IF NEW.account_id IS NOT NULL THEN
        UPDATE accounts
        SET balance = balance - NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Refund the account when expense is deleted
    IF OLD.account_id IS NOT NULL THEN
      UPDATE accounts
      SET balance = balance + OLD.amount,
          updated_at = now()
      WHERE id = OLD.account_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for expense account deduction
DROP TRIGGER IF EXISTS trigger_expense_account_deduction ON expenses;
CREATE TRIGGER trigger_expense_account_deduction
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION handle_expense_account_deduction();

-- Update RLS policies to check account access
DROP POLICY IF EXISTS "Users can insert their own expenses" ON expenses;
CREATE POLICY "Users can insert their own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    (account_id IS NULL OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_id
    ))
  );

DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
CREATE POLICY "Users can update their own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    (auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )) AND
    (account_id IS NULL OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_id
    ))
  );
