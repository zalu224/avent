import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Monthly credit caps for metered APIs, enforced in the database so every
 * server instance shares one counter. Fails closed: if usage can't be
 * recorded, the call is not allowed.
 */

const DEFAULT_LIMITS: Record<string, number> = {
  // Tavily's free plan is 1,500 credits/month; leave headroom for retries.
  tavily: 1400,
};

export function creditLimit(provider: string) {
  const fromEnv = process.env[`${provider.toUpperCase()}_MONTHLY_CREDIT_LIMIT`];
  const parsed = fromEnv ? Number.parseInt(fromEnv, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : (DEFAULT_LIMITS[provider] ?? 0);
}

/** Reserves `amount` credits for this month. Returns false when over the cap. */
export async function reserveCredits(provider: string, amount: number): Promise<boolean> {
  const limit = creditLimit(provider);
  if (limit <= 0) return false;

  const admin = createAdminClient();
  if (!admin) {
    console.warn(`[usage] no admin client; refusing ${provider} call to stay within plan`);
    return false;
  }

  const { data, error } = await admin.rpc("consume_api_credits", {
    p_provider: provider,
    p_amount: amount,
    p_limit: limit,
  });
  if (error) {
    console.warn(`[usage] could not record ${provider} usage; refusing call`, error.message);
    return false;
  }
  if (data !== true) {
    console.warn(`[usage] ${provider} monthly cap of ${limit} reached; skipping`);
    return false;
  }
  return true;
}

/** Current month's usage for display or debugging. */
export async function monthlyUsage(provider: string): Promise<{ used: number; limit: number } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const period = new Date().toISOString().slice(0, 7);
  const { data } = await admin
    .from("api_usage")
    .select("used")
    .match({ provider, period })
    .maybeSingle();
  return { used: (data?.used as number | undefined) ?? 0, limit: creditLimit(provider) };
}
