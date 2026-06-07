/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for foreign keys that are missing covering indexes
    - These indexes improve JOIN performance and foreign key constraint checks

  2. New Indexes
    - `company_invitations_invited_by_fkey` → `idx_company_invitations_invited_by`
    - `report_templates_created_by_fkey` → `idx_report_templates_created_by`
    - `saved_reports_generated_by_fkey` → `idx_saved_reports_generated_by`
    - `saved_reports_template_id_fkey` → `idx_saved_reports_template_id`

  3. Notes
    - Indexes are created with IF NOT EXISTS to prevent errors
    - These indexes significantly improve query performance for related tables
*/

-- Add index for company_invitations.invited_by
CREATE INDEX IF NOT EXISTS idx_company_invitations_invited_by 
ON public.company_invitations(invited_by);

-- Add index for report_templates.created_by
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by 
ON public.report_templates(created_by);

-- Add index for saved_reports.generated_by
CREATE INDEX IF NOT EXISTS idx_saved_reports_generated_by 
ON public.saved_reports(generated_by);

-- Add index for saved_reports.template_id
CREATE INDEX IF NOT EXISTS idx_saved_reports_template_id 
ON public.saved_reports(template_id);