/*
  # Add Soft Delete Support to Payments

  1. Changes
    - Add `deleted_at` column to payments table
    - Create trigger to automatically soft-delete payments when invoice is soft-deleted
    - Create trigger to restore payments when invoice is restored
    - Update payment balance trigger to handle soft deletes properly

  2. Soft Delete Behavior
    - When an invoice is moved to trash, all its payments are automatically soft-deleted
    - When an invoice is restored from trash, all its payments are restored
    - Soft-deleted payments have their amounts removed from account balances
    - Restored payments have their amounts added back to account balances

  3. Important Notes
    - Payments cannot be individually soft-deleted - they follow their parent invoice
    - Account balances are automatically updated when payments are soft-deleted/restored
    - This ensures bank accounts reflect only active (non-trashed) payments
*/

-- Add deleted_at column to payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON payments(deleted_at);

-- Function to cascade soft delete from documents to payments
CREATE OR REPLACE FUNCTION cascade_document_soft_delete_to_payments()
RETURNS TRIGGER AS $$
BEGIN
  -- When document is soft deleted, soft delete all its payments
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE payments
    SET deleted_at = NEW.deleted_at
    WHERE document_id = NEW.id AND deleted_at IS NULL;
  END IF;
  
  -- When document is restored, restore all its payments
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE payments
    SET deleted_at = NULL
    WHERE document_id = NEW.id AND deleted_at IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cascading soft deletes
DROP TRIGGER IF EXISTS trigger_cascade_document_soft_delete_to_payments ON documents;
CREATE TRIGGER trigger_cascade_document_soft_delete_to_payments
  AFTER UPDATE ON documents
  FOR EACH ROW
  WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION cascade_document_soft_delete_to_payments();

-- Update payment balance trigger to handle soft deletes
CREATE OR REPLACE FUNCTION handle_payment_account_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only add payment amount if not already deleted
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
      -- Add the payment amount back to account (payment is being restored)
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
    -- Only deduct if the payment was active (not soft deleted)
    IF OLD.account_id IS NOT NULL AND OLD.currency IS NOT NULL AND OLD.deleted_at IS NULL THEN
      PERFORM upsert_account_balance(OLD.account_id, OLD.currency, -OLD.amount);
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for payment account credit
DROP TRIGGER IF EXISTS trigger_payment_account_credit ON payments;
CREATE TRIGGER trigger_payment_account_credit
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_payment_account_credit();