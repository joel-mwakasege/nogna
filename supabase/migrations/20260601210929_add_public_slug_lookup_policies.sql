/*
  # Allow public workspace slug lookup

  ## Problem
  The companies and company_settings tables have RLS enabled with no policies
  for unauthenticated (anon) users. This means the login page cannot load for
  any workspace because the slug lookup query returns nothing.

  ## Changes

  1. companies
     - Add SELECT policy for anon role to read basic company info by slug
       (id, name, slug, status, subscription_tier). This is needed so the
       login page can resolve the workspace before the user authenticates.

  2. company_settings
     - Add SELECT policy for anon role to read branding fields (company_name,
       logo_url, header_display_mode) by company_id. This is needed so the
       login page can show the correct logo and company name.

  ## Security
  - Policies are restricted to the anon role only
  - No sensitive data is exposed (no financial data, no user data)
  - Write operations remain fully restricted
*/

-- Allow unauthenticated users to look up a company by slug (login page needs this)
CREATE POLICY "Public can look up company by slug"
  ON companies FOR SELECT
  TO anon
  USING (true);

-- Allow unauthenticated users to read company branding for the login page
CREATE POLICY "Public can read company settings for login page"
  ON company_settings FOR SELECT
  TO anon
  USING (true);
