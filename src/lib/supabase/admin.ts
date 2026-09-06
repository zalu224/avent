import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only admin client. Used solely to look up a user's email address
 * for notifications. Never pass this client to user-facing code paths.
 */
function adminKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function isAdminConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && adminKey());
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = adminKey();
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.error("[email] could not look up recipient", error.message);
    return null;
  }
  return data.user?.email ?? null;
}
