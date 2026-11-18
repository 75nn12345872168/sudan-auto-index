import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FALLBACK_LISTINGS } from "./fallback-data";
import {
  DEFAULT_PARALLEL_RATE,
  type CarListing,
  type ExchangeRate,
} from "./types";

let cachedClient: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      anonKey &&
      !url.includes("your-project-id") &&
      !anonKey.includes("your-supabase-anon-key")
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  if (!isSupabaseConfigured()) {
    cachedClient = null;
    return null;
  }
  cachedClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );
  return cachedClient;
}

export interface InitialMarketData {
  listings: CarListing[];
  exchangeRate: ExchangeRate;
  isLiveDatabase: boolean;
}

export async function fetchInitialMarketData(): Promise<InitialMarketData> {
  const fallbackRate: ExchangeRate = {
    parallel_rate: DEFAULT_PARALLEL_RATE,
    official_rate: 1990,
    source: "السعر الموازي المرجعي",
    updated_at: new Date().toISOString(),
  };

  const client = getSupabaseClient();
  if (!client) {
    return {
      listings: FALLBACK_LISTINGS,
      exchangeRate: fallbackRate,
      isLiveDatabase: false,
    };
  }

  try {
    const [rateRes, listingsRes] = await Promise.all([
      client
        .from("exchange_rates")
        .select("parallel_rate, official_rate, source, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1),
      client
        .from("car_listings")
        .select(
          "id, external_id, source_platform, category, title, model_tag, year_tag, legal_status, price_sdg, price_usd, city, image_url, seller_phone, source_url, is_featured, is_verified_dealer, is_active, last_seen_at, created_at"
        )
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("last_seen_at", { ascending: false })
        .limit(120),
    ]);

    const rateRow = rateRes.data?.[0];
    const exchangeRate: ExchangeRate = rateRow
      ? {
          parallel_rate: Number(rateRow.parallel_rate) || DEFAULT_PARALLEL_RATE,
          official_rate: rateRow.official_rate ? Number(rateRow.official_rate) : null,
          source: rateRow.source || "السعر الموازي المرجعي",
          updated_at: rateRow.updated_at || fallbackRate.updated_at,
        }
      : fallbackRate;

    const dbListings = (listingsRes.data ?? []).map((row) => ({
      ...row,
      price_sdg: row.price_sdg !== null ? Number(row.price_sdg) : null,
      price_usd: row.price_usd !== null ? Number(row.price_usd) : null,
    })) as CarListing[];

    if (dbListings.length === 0) {
      return {
        listings: FALLBACK_LISTINGS,
        exchangeRate,
        isLiveDatabase: !listingsRes.error,
      };
    }

    return {
      listings: dbListings,
      exchangeRate,
      isLiveDatabase: true,
    };
  } catch {
    return {
      listings: FALLBACK_LISTINGS,
      exchangeRate: fallbackRate,
      isLiveDatabase: false,
    };
  }
}
