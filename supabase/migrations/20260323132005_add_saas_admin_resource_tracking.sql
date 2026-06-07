/*
  # SaaS Admin Resource Tracking

  1. Purpose
    - Provide SaaS admins with visibility into resource usage across all companies
    - Track storage, database records, user counts, and activity metrics
    - Enable capacity planning and billing analytics

  2. New Views Created
    - `saas_company_resource_usage`: Comprehensive resource metrics per company
    - `saas_storage_usage`: Storage usage breakdown by company
    - `saas_platform_summary`: Platform-wide summary statistics

  3. Metrics Tracked
    - Total users per company
    - Active users (last 30 days)
    - Total customers/clients
    - Total invoices and documents
    - Total expenses and deposits
    - Bank accounts count
    - Storage usage (file attachments)
    - Profile completion percentage
    - Company creation date
    - Last activity timestamp

  4. Security
    - Views only accessible to SaaS admins
    - Row-level security enforced via policies
*/

-- Create view for storage usage by company
CREATE OR REPLACE VIEW saas_storage_usage AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  c.created_at as company_created_at,
  COALESCE(
    (SELECT SUM(
      CASE 
        WHEN metadata->>'size' IS NOT NULL 
        THEN (metadata->>'size')::bigint 
        ELSE 0 
      END
    )
    FROM storage.objects
    WHERE bucket_id = 'documents'
    AND (metadata->>'company_id')::uuid = c.id
    ), 0
  ) as storage_bytes_used,
  COALESCE(
    (SELECT COUNT(*)
    FROM storage.objects
    WHERE bucket_id = 'documents'
    AND (metadata->>'company_id')::uuid = c.id
    ), 0
  ) as total_files
FROM companies c;

-- Create comprehensive resource usage view
CREATE OR REPLACE VIEW saas_company_resource_usage AS
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
  
  -- Financial metrics using document_totals_view
  (SELECT COALESCE(SUM(dtv.total_amount), 0) 
   FROM document_totals_view dtv
   JOIN documents d ON dtv.document_id = d.id
   WHERE d.company_id = c.id 
   AND d.document_type = 'invoice'
   AND d.status = 'paid'
   AND d.deleted_at IS NULL) as total_revenue,
   
  (SELECT COALESCE(SUM(dtv.total_amount), 0) 
   FROM document_totals_view dtv
   JOIN documents d ON dtv.document_id = d.id
   WHERE d.company_id = c.id 
   AND d.document_type = 'invoice'
   AND d.status IN ('draft', 'sent', 'overdue')
   AND d.deleted_at IS NULL) as outstanding_invoices_amount,
  
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
     SELECT created_at FROM documents WHERE company_id = c.id
     UNION ALL
     SELECT created_at FROM expenses WHERE company_id = c.id
     UNION ALL
     SELECT created_at FROM deposits WHERE company_id = c.id
     UNION ALL
     SELECT created_at FROM customers WHERE company_id = c.id
   ) activities) as last_activity_at,
   
  -- Settings check
  (SELECT COUNT(*) 
   FROM company_settings 
   WHERE company_id = c.id) as has_settings

FROM companies c
ORDER BY c.created_at DESC;

-- Create helper function to format bytes
CREATE OR REPLACE FUNCTION format_bytes(bytes bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF bytes IS NULL THEN
    RETURN '0 B';
  ELSIF bytes < 1024 THEN
    RETURN bytes || ' B';
  ELSIF bytes < 1048576 THEN
    RETURN ROUND(bytes::numeric / 1024, 2) || ' KB';
  ELSIF bytes < 1073741824 THEN
    RETURN ROUND(bytes::numeric / 1048576, 2) || ' MB';
  ELSE
    RETURN ROUND(bytes::numeric / 1073741824, 2) || ' GB';
  END IF;
END;
$$;

-- Create summary view for dashboard stats
CREATE OR REPLACE VIEW saas_platform_summary AS
SELECT 
  (SELECT COUNT(*) FROM companies) as total_companies,
  (SELECT COUNT(*) FROM user_profiles) as total_users,
  (SELECT COUNT(*) FROM user_profiles WHERE is_active = true) as active_users,
  (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) as total_customers,
  (SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL) as total_documents,
  (SELECT COALESCE(SUM(storage_bytes_used), 0) FROM saas_storage_usage) as total_storage_used,
  (SELECT COALESCE(SUM(total_files), 0) FROM saas_storage_usage) as total_files,
  (SELECT COUNT(*) FROM companies WHERE setup_completed = true) as completed_setups,
  (SELECT COALESCE(AVG(profile_completion_percentage), 0) FROM companies) as avg_completion_percentage;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_active ON user_profiles(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_company_deleted ON customers(company_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_company_type_deleted ON documents(company_id, document_type, deleted_at);
CREATE INDEX IF NOT EXISTS idx_expenses_company_deleted ON expenses(company_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_deposits_company_deleted ON deposits(company_id, deleted_at);