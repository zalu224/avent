import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Free-allowance caps for metered APIs, enforced in the database so every
 * server instance shares one counter. Fails closed: if usage can't be
 * recorded, the call is not allowed.
 */

export type UsagePeriod = "month" | "day";

const DEFAULT_LIMITS: Record<string, number> = {
  // Tavily's free plan is 1,500 credits/month; leave headroom for retries.
  tavily: 1400,
  // Google Programmable Search allows 100 queries/day before billing.
  google_cse: 95,
};

export function creditLimit(provider: string) {
  const fromEnv = process.env[`${provider.toUpperCase()}_CREDIT_LIMIT`] ??
    process.env[`${provider.toUpperCase()}_MONTHLY_CREDIT_LIMIT`];
  const parsed = fromEnv ? Number.parseInt(fromEnv, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : (DEFAULT_LIMITS[provider] ?? 0);
}

export function periodKey(period: UsagePeriod, at = new Date()) {
  const iso = at.toISOString();
  return period === "day" ? iso.slice(0, 10) : iso.slice(0, 7);
}

/** Reserves `amount` credits for the current period. Returns false when over the cap. */
export async function reserveCredits(
  provider: string,
  amount: number,
  period: UsagePeriod = "month"
): Promise<boolean> {
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
    p_period: periodKey(period),
  });
  if (error) {
    console.warn(`[usage] could not record ${provider} usage; refusing call`, error.message);
    return false;
  }
  if (data !== true) {
    console.warn(`[usage] ${provider} cap of ${limit} per ${period} reached; skipping`);
    return false;
  }
  return true;
}

/** Current period's usage for display or debugging. */
export async function usageFor(
  provider: string,
  period: UsagePeriod = "month"
): Promise<{ used: number; limit: number; period: string } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const key = periodKey(period);
  const { data } = await admin
    .from("api_usage")
    .select("used")
    .match({ provider, period: key })
    .maybeSingle();
  return { used: (data?.used as number | undefined) ?? 0, limit: creditLimit(provider), period: key };
}
