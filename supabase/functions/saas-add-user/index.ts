import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SaasAddUserRequest {
  email: string;
  password: string;
  role: string;
  name?: string;
  companyId: string;
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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must be a SuperAdmin
    const { data: saasAdmin } = await supabaseAdmin
      .from("saas_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!saasAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: SuperAdmin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, role, name, companyId }: SaasAddUserRequest = await req.json();

    if (!email || !password || !role || !companyId) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, password, role, companyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["user", "admin", "owner"].includes(role)) {
      return new Response(JSON.stringify({ error: "Role must be 'user', 'admin', or 'owner'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the target company exists
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, max_users")
      .eq("id", companyId)
      .maybeSingle();

    if (!company) {
      return new Response(JSON.stringify({ error: "Target company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check max users
    const { count } = await supabaseAdmin
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);

    if (count !== null && count >= company.max_users) {
      return new Response(
        JSON.stringify({ error: `User limit reached. ${company.name} allows a maximum of ${company.max_users} users.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already in use
    const { data: existing } = await supabaseAdmin
      .from("user_profiles")
      .select("id, company_id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      if (existing.company_id === companyId) {
        return new Response(JSON.stringify({ error: "A user with this email already exists in this company" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.company_id !== null) {
        return new Response(JSON.stringify({ error: "This email is already registered with another company" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { name } : {},
    });

    if (createError || !authData.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = authData.user.id;

    // Poll for profile row
    let profileExists = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const { data: check } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("id", newUserId)
        .maybeSingle();
      if (check) { profileExists = true; break; }
    }

    if (!profileExists) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: "Profile creation timed out. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileUpdate: Record<string, string> = { company_id: companyId, role };
    if (name) profileUpdate.name = name;

    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update(profileUpdate)
      .eq("id", newUserId);

    if (updateError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user: { id: newUserId, email, role, company_id: companyId } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
