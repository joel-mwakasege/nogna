/*
  # Update Document Status Values

  1. Changes
    - Update status constraint to use 'unpaid' instead of 'pending'
    - Migrate existing 'pending' records to 'unpaid'
    - Keep 'paid', 'partially_paid', 'draft', and 'overdue' as-is

  2. Status Meanings
    - `draft`: Document is being prepared
    - `unpaid`: No payment received yet
    - `partially_paid`: Portion of amount has been paid
    - `paid`: Full payment received
    - `overdue`: Payment is past due date

  3. Migration Strategy
    - First update existing data
    - Then update the constraint
*/

-- Update existing 'pending' records to 'unpaid'
UPDATE documents 
SET status = 'unpaid' 
WHERE status = 'pending';

-- Drop the existing constraint
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_status_check;

-- Add the new constraint with updated status values
ALTER TABLE documents 
ADD CONSTRAINT documents_status_check 
CHECK (status IN ('draft', 'unpaid', 'paid', 'partially_paid', 'overdue'));