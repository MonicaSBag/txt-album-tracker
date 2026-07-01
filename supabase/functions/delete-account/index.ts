import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDeletionEmailHtml } from "./email-template.ts";

// Estas tres variables están disponibles automáticamente en toda Edge
// Function de Supabase, no hace falta configurarlas a mano.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Esta sí hay que configurarla a mano: supabase secrets set RESEND_API_KEY=re_xxx
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "TXT Album Tracker <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendDeletionEmail(email: string, name?: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY no configurada; se omite el email de confirmación.");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject: "Tu cuenta fue eliminada — TXT Album Tracker",
        html: buildDeletionEmailHtml({ name, email }),
      }),
    });

    if (!res.ok) {
      console.error("Error enviando email de confirmación:", await res.text());
    }
  } catch (err) {
    console.error("Excepción enviando email de confirmación:", err);
  }
  // No relanzamos ningún error: el borrado de la cuenta ya se hizo bien,
  // que falle el email no debe hacer fallar la respuesta al usuario.
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Falta el header de autorización" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente "como el usuario": solo sirve para confirmar quién está pidiendo el borrado.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No se pudo verificar el usuario" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guardamos estos datos ANTES de borrar, porque después de deleteUser
    // ya no se puede volver a consultar auth.users por este id.
    const email = user.email;
    const name = user.user_metadata?.name as string | undefined;

    // Cliente admin (service role): el único que puede borrar usuarios.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Al borrar el usuario, user_collection se limpia solo por el
    // "on delete cascade" de la foreign key hacia auth.users(id).

    if (email) {
      await sendDeletionEmail(email, name);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});