/*
  # Recreate SaaS Company Resource Usage View

  ## Summary
  Recreates the saas_company_resource_usage view with proper company_id filtering
  and grants access to authenticated users (specifically SaaS admins).

  ## Changes Made
  1. Drop and recreate saas_company_resource_usage view
  2. Update view to use company_id from document_totals_view
  3. Grant SELECT permissions to authenticated users
  4. Add security notes for SaaS admin access

  ## Important Notes
  - View aggregates resource usage metrics per company
  - Access should be restricted to SaaS admins in application layer
  - Provides comprehensive company analytics for platform management
*/

-- Drop existing view if it exists
DROP VIEW IF EXISTS saas_company_resource_usage CASCADE;

-- Recreate comprehensive resource usage view with updated document_totals_view
CREATE VIEW saas_company_resource_usage AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  c.created_at as company_created_at,
  c.profile_completion_percentage,
  c.setup_completed,
  
  -- User metrics
  (SELECT COUNT(*) 
   FROM user_profiles 
   WHERE company_id = c.id) as total_users,
   
  (SELECT COUNT(*) 
   FROM user_profiles 
   WHERE company_id = c.id 
   AND is_active = true) as active_users,
   
  (SELECT COUNT(*) 
   FROM user_profiles 
   WHERE company_id = c.id 
   AND role = 'owner') as owner_count,
   
  (SELECT COUNT(*) 
   FROM user_profiles 
   WHERE company_id = c.id 
   AND role = 'admin') as admin_count,
  
  -- Customer metrics
  (SELECT COUNT(*) 
   FROM customers 
   WHERE company_id = c.id 
   AND deleted_at IS NULL) as total_customers,
  
  -- Document metrics
  (SELECT COUNT(*) 
   FROM documents 
   WHERE company_id = c.id 
   AND deleted_at IS NULL) as total_documents,
   
  (SELECT COUNT(*) 
   FROM documents 
   WHERE company_id = c.id 
   AND document_type = 'invoice'
   AND deleted_at IS NULL) as total_invoices,
   
  (SELECT COUNT(*) 
   FROM documents 
   WHERE company_id = c.id 
   AND document_type = 'estimate'
   AND deleted_at IS NULL) as total_estimates,
  
  -- Financial metrics using updated document_totals_view with company_id
  (SELECT COALESCE(SUM(dtv.total_amount), 0) 
   FROM document_totals_view dtv
   WHERE dtv.company_id = c.id 
   AND dtv.document_type = 'invoice'
   AND dtv.status = 'paid') as total_revenue,
   
  (SELECT COALESCE(SUM(dtv.total_amount), 0) 
   FROM document_totals_view dtv
   WHERE dtv.company_id = c.id 
   AND dtv.document_type = 'invoice'
   AND dtv.status IN ('pending', 'overdue', 'partially_paid')) as outstanding_invoices_amount,
  
  -- Expense metrics
  (SELECT COUNT(*) 
   FROM expenses 
   WHERE company_id = c.id 
   AND deleted_at IS NULL) as total_expenses,
   
  (SELECT COALESCE(SUM(amount), 0) 
   FROM expenses 
   WHERE company_id = c.id 
   AND deleted_at IS NULL) as total_expense_amount,
  
  -- Deposit metrics
  (SELECT COUNT(*) 
   FROM deposits 
   WHERE company_id = c.id 
   AND deleted_at IS NULL) as total_deposits,
   
  (SELECT COALESCE(SUM(amount), 0) 
   FROM deposits 
   WHERE company_id = c.id 
   AND deleted_at IS NULL) as total_deposit_amount,
  
  -- Account metrics
  (SELECT COUNT(*) 
   FROM accounts 
   WHERE company_id = c.id 
   AND deleted_at IS NULL) as total_accounts,
  
  -- Storage metrics
  (SELECT storage_bytes_used 
   FROM saas_storage_usage 
   WHERE company_id = c.id) as storage_bytes_used,
   
  (SELECT total_files 
   FROM saas_storage_usage 
   WHERE company_id = c.id) as total_files,
  
  -- Activity metrics
  (SELECT MAX(created_at)
   FROM (
     SELECT created_at FROM documents WHERE company_id = c.id AND deleted_at IS NULL
     UNION ALL
     SELECT created_at FROM expenses WHERE company_id = c.id AND deleted_at IS NULL
     UNION ALL
     SELECT created_at FROM deposits WHERE company_id = c.id AND deleted_at IS NULL
     UNION ALL
     SELECT created_at FROM customers WHERE company_id = c.id AND deleted_at IS NULL
   ) activities) as last_activity_at,
   
  -- Settings check
  (SELECT COUNT(*) 
   FROM company_settings 
   WHERE company_id = c.id) as has_settings

FROM companies c
ORDER BY c.created_at DESC;

-- Grant SELECT on SaaS admin views to authenticated users
-- Note: Application layer should enforce that only SaaS admins can access these views
GRANT SELECT ON saas_company_resource_usage TO authenticated;
GRANT SELECT ON saas_storage_usage TO authenticated;
GRANT SELECT ON saas_platform_summary TO authenticated;
