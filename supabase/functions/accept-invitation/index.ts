import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AcceptInvitationRequest {
  token: string;
  password: string;
  name?: string;
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

    const { token, password, name }: AcceptInvitationRequest = await req.json();

    if (!token || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields: token, password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("company_invitations")
      .select("id, email, role, company_id, accepted_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found or invalid token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invitation.accepted_at) {
      return new Response(JSON.stringify({ error: "This invitation has already been accepted" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This invitation has expired. Please ask your admin to resend it." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company info for response
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, max_users")
      .eq("id", invitation.company_id)
      .maybeSingle();

    if (!company) {
      return new Response(JSON.stringify({ error: "The company associated with this invitation no longer exists" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user count limit
    const { count } = await supabaseAdmin
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company.id);

    if (count !== null && count >= company.max_users) {
      return new Response(
        JSON.stringify({ error: "This company has reached its user limit. Contact your administrator." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user with this email already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("id, company_id")
      .eq("email", invitation.email)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      if (existingProfile.company_id && existingProfile.company_id !== company.id) {
        return new Response(
          JSON.stringify({ error: "This email already belongs to a user in another company" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // User exists, update their password and assign to company
      userId = existingProfile.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    } else {
      // Create new auth user
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: name ? { name } : {},
      });

      if (createError || !authData.user) {
        return new Response(JSON.stringify({ error: createError?.message || "Failed to create user account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = authData.user.id;

      // Poll for trigger-created profile row
      let profileExists = false;
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const { data: check } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        if (check) { profileExists = true; break; }
      }

      if (!profileExists) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: "Profile creation timed out. Please try again." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Assign company_id, role, and name on the profile
    const profileUpdate: Record<string, string> = {
      company_id: company.id,
      role: invitation.role,
    };
    if (name) profileUpdate.name = name;

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileError) {
      return new Response(JSON.stringify({ error: `Failed to update user profile: ${profileError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark invitation as accepted
    await supabaseAdmin
      .from("company_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return new Response(
      JSON.stringify({
        success: true,
        email: invitation.email,
        company: { id: company.id, name: company.name },
        role: invitation.role,
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
