import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateCompanyRequest {
  companyName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  subscriptionTier?: string;
  maxUsers?: number;
  status?: string;
  durationDays?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: saasAdmin } = await supabaseAdmin
      .from("saas_admins")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!saasAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: SuperAdmin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      companyName,
      slug,
      ownerName,
      ownerEmail,
      ownerPassword,
      subscriptionTier = "free",
      maxUsers = 5,
      status = "trial",
      durationDays = 30,
    }: CreateCompanyRequest = await req.json();

    if (!companyName || !slug || !ownerName || !ownerEmail || !ownerPassword) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: companyName, slug, ownerName, ownerEmail, ownerPassword" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (slug.length < 3 || !/^[a-z0-9-]+$/.test(slug)) {
      return new Response(
        JSON.stringify({ error: "Slug must be at least 3 characters (lowercase letters, numbers, hyphens only)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ownerPassword.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeMaxUsers = typeof maxUsers === "number" && !isNaN(maxUsers) ? maxUsers : 5;
    if (safeMaxUsers < 5) {
      return new Response(JSON.stringify({ error: "Max users must be at least 5" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check slug uniqueness
    const { data: existingCompany } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingCompany) {
      return new Response(JSON.stringify({ error: "A company with this slug already exists" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if owner email already exists and is already assigned to a company
    const { data: existingProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("id, email, company_id")
      .eq("email", ownerEmail)
      .maybeSingle();

    if (existingProfile?.company_id) {
      return new Response(
        JSON.stringify({
          error: "This email already belongs to a user in another company. Use a different email address.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let ownerId: string;
    let isNewUser = false;

    if (existingProfile) {
      // Existing user with no company — assign them as owner
      ownerId = existingProfile.id;
    } else {
      const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: { name: ownerName },
      });

      if (createUserError || !authData.user) {
        return new Response(
          JSON.stringify({ error: createUserError?.message || "Failed to create owner auth account" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      ownerId = authData.user.id;
      isNewUser = true;

      // Poll for trigger-created profile row (up to 2 seconds)
      let profileExists = false;
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const { data: check } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("id", ownerId)
          .maybeSingle();
        if (check) { profileExists = true; break; }
      }

      if (!profileExists) {
        await supabaseAdmin.auth.admin.deleteUser(ownerId);
        return new Response(
          JSON.stringify({ error: "Profile creation timed out. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + durationDays);

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: companyName,
        slug,
        status,
        subscription_tier: subscriptionTier,
        max_users: safeMaxUsers,
        created_by: ownerId,
        subscription_expires_at: subscriptionExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (companyError) {
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(ownerId);
      return new Response(
        JSON.stringify({ error: `Failed to create company record: ${companyError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set owner profile fields atomically
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .update({ name: ownerName, company_id: company.id, role: "owner" })
      .eq("id", ownerId);

    if (profileError) {
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(ownerId);
      return new Response(
        JSON.stringify({ error: `Failed to assign owner profile: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create default company settings
    const { error: settingsError } = await supabaseAdmin
      .from("company_settings")
      .insert({ user_id: ownerId, company_id: company.id });

    if (settingsError) {
      return new Response(
        JSON.stringify({ error: `Company created but settings init failed: ${settingsError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        company: { id: company.id, name: company.name, slug: company.slug },
        owner: { id: ownerId, email: ownerEmail, name: ownerName, isNewUser },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
