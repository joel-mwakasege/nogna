/*
  # Add Assigned User to Expenses

  1. Changes
    - Add `assigned_to_user_id` column to `expenses` table
      - References `user_profiles(id)` for tracking which user the expense is assigned to
      - Nullable field (expenses can be unassigned)
      - Separate from `user_id` which tracks who created the expense
    
  2. Purpose
    - Allows tracking which user an expense belongs to or is assigned to
    - Useful for expense reimbursement tracking
    - Helps with per-user expense reporting
    - Creator and assigned user can be different people
    
  3. Security
    - No RLS changes needed - existing policies cover this field
    - Users can still view all expenses
    - Users can still update/delete their own created expenses
*/

-- Add assigned_to_user_id column to expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'assigned_to_user_id'
  ) THEN
    ALTER TABLE expenses 
    ADD COLUMN assigned_to_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_assigned_to_user_id ON expenses(assigned_to_user_id);

-- Add helpful comment
COMMENT ON COLUMN expenses.assigned_to_user_id IS 'User that this expense is assigned to or belongs to (can be different from creator)';
