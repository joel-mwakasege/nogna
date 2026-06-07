/*
  # Add Line Item Grouping for Combined Pricing
  
  1. Changes to document_line_items table
    - Add `group_id` (uuid, nullable) - Identifies items that belong to the same price group
    - Add `is_group_parent` (boolean, default false) - Marks the item that holds the combined unit cost
    - Add index on group_id for better query performance
  
  2. Behavior
    - Items with the same group_id share a combined unit cost
    - The group parent item stores the shared unit_cost
    - Child items in the group inherit the parent's unit_cost for calculations
    - Each item maintains its own units and days values
    
  3. Notes
    - When group_id is NULL, item behaves as a regular independent line item
    - When group_id is set, items are part of a combined pricing group
    - Only one item per group should have is_group_parent = true
*/

-- Add grouping fields to document_line_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_line_items' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE document_line_items 
    ADD COLUMN group_id uuid DEFAULT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_line_items' AND column_name = 'is_group_parent'
  ) THEN
    ALTER TABLE document_line_items 
    ADD COLUMN is_group_parent boolean DEFAULT false;
  END IF;
END $$;

-- Create index for better performance when querying grouped items
CREATE INDEX IF NOT EXISTS idx_document_line_items_group_id 
ON document_line_items(group_id) 
WHERE group_id IS NOT NULL;