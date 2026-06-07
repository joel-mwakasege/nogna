/*
  # Backfill company_id on payments table

  ## Problem
  Payments inserted before multi-tenancy was fully enforced have NULL company_id.
  The UPDATE RLS policy requires company_id to match the current user's company,
  so any payment with NULL company_id is invisible to the policy and cannot be
  soft-deleted (or updated at all), producing "Failed to delete payment" errors.

  ## Changes
  1. Backfill payments.company_id from the parent document's company_id for all
     rows where company_id IS NULL.
  2. No rows are deleted — this is a safe data fix only.

  ## Security
  No RLS changes. This migration only fixes data integrity so existing RLS
  policies can evaluate correctly.
*/

UPDATE payments
SET company_id = documents.company_id
FROM documents
WHERE payments.document_id = documents.id
  AND payments.company_id IS NULL
  AND documents.company_id IS NOT NULL;
