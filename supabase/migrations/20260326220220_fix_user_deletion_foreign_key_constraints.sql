/*
  # Fix User Deletion - Add CASCADE to Foreign Key Constraints

  This migration fixes foreign key constraints that were preventing user deletion.
  
  ## Changes
  
  1. **account_transfers** - Change created_by to CASCADE on delete
  2. **companies** - Change created_by to SET NULL on delete (preserve company data)
  3. **company_invitations** - Change invited_by to SET NULL on delete
  4. **deposit_attachments** - Change uploaded_by to SET NULL on delete
  5. **expense_attachments** - Change uploaded_by to SET NULL on delete
  
  ## Rationale
  
  - User deletion should not fail due to related records
  - For audit trails (created_by, uploaded_by, invited_by), we set to NULL to preserve records
  - For orphaned data (account_transfers), we cascade delete since they're meaningless without the user
*/

-- Fix account_transfers: CASCADE delete when user is deleted
ALTER TABLE account_transfers 
  DROP CONSTRAINT IF EXISTS account_transfers_created_by_fkey,
  ADD CONSTRAINT account_transfers_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Fix companies: SET NULL when creator is deleted (preserve company)
ALTER TABLE companies 
  DROP CONSTRAINT IF EXISTS companies_created_by_fkey,
  ADD CONSTRAINT companies_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- Fix company_invitations: SET NULL when inviter is deleted
ALTER TABLE company_invitations 
  DROP CONSTRAINT IF EXISTS company_invitations_invited_by_fkey,
  ADD CONSTRAINT company_invitations_invited_by_fkey 
    FOREIGN KEY (invited_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- Fix deposit_attachments: SET NULL when uploader is deleted
ALTER TABLE deposit_attachments 
  DROP CONSTRAINT IF EXISTS deposit_attachments_uploaded_by_fkey,
  ADD CONSTRAINT deposit_attachments_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- Fix expense_attachments: SET NULL when uploader is deleted
ALTER TABLE expense_attachments 
  DROP CONSTRAINT IF EXISTS expense_attachments_uploaded_by_fkey,
  ADD CONSTRAINT expense_attachments_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;