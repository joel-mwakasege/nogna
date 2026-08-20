-- Create a secure, multi-tenant view for Net VAT reporting
CREATE OR REPLACE VIEW net_vat_by_period_view WITH (security_invoker = true) AS

WITH output_vat AS (
    -- 1. Aggregate VAT collected from Sales (Invoices)
    SELECT
        company_id,
        currency,
        EXTRACT(year FROM issue_date) AS year,
        EXTRACT(month FROM issue_date) AS month,
        SUM(COALESCE(tax_amount, 0)) AS total_output_vat
    FROM 
        document_totals_view
    WHERE 
        document_type = 'invoice' 
        AND status != 'draft' -- Exclude drafts, only count finalized sales
    GROUP BY 
        company_id, currency, EXTRACT(year FROM issue_date), EXTRACT(month FROM issue_date)
),

input_vat AS (
    -- 2. Aggregate VAT paid on Purchases (Expenses)
    SELECT
        e.company_id,
        c.code AS currency,
        EXTRACT(year FROM e.expense_date) AS year,
        EXTRACT(month FROM e.expense_date) AS month,
        SUM(COALESCE(e.tax_amount, 0)) AS total_input_vat
    FROM 
        expenses e
    LEFT JOIN 
        currencies c ON e.currency_id = c.id
    WHERE 
        e.deleted_at IS NULL -- Respect the soft-delete/trash system
    GROUP BY 
        e.company_id, c.code, EXTRACT(year FROM e.expense_date), EXTRACT(month FROM e.expense_date)
)

-- 3. Combine Input and Output VAT to calculate Net Tax Liability
SELECT
    COALESCE(o.company_id, i.company_id) AS company_id,
    COALESCE(o.year, i.year) AS year,
    COALESCE(o.month, i.month) AS month,
    COALESCE(o.currency, i.currency) AS currency,
    COALESCE(o.total_output_vat, 0) AS total_output_vat,
    COALESCE(i.total_input_vat, 0) AS total_input_vat,
    (COALESCE(o.total_output_vat, 0) - COALESCE(i.total_input_vat, 0)) AS net_vat_payable
FROM 
    output_vat o
FULL OUTER JOIN 
    input_vat i
    ON o.company_id = i.company_id
    AND o.year = i.year
    AND o.month = i.month
    AND o.currency = i.currency;

-- Grant access to authenticated users (RLS is enforced via security_invoker)
GRANT SELECT ON net_vat_by_period_view TO authenticated;
