-- ============================================================================
-- Sudan Auto Index (مرصد أسعار السيارات وقطع الغيار والآليات في السودان)
-- Complete PostgreSQL Schema, RLS Policies, Storage Bucket & Seed Data
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Exchange Rates Table (FX Engine)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  currency_pair TEXT UNIQUE NOT NULL DEFAULT 'USD/SDG',
  parallel_rate NUMERIC(12, 2) NOT NULL CHECK (parallel_rate > 0),
  official_rate NUMERIC(12, 2),
  source TEXT NOT NULL DEFAULT 'Sudan Market FX',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default parallel rate (2,650 SDG/USD) idempotently
INSERT INTO public.exchange_rates (currency_pair, parallel_rate, official_rate, source)
VALUES ('USD/SDG', 2650.00, 1990.00, 'Default Parallel Market Benchmark')
ON CONFLICT (currency_pair) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Car, Machinery & Spare Parts Listings Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.car_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL,
  source_platform TEXT NOT NULL DEFAULT 'OpenSooq',
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  model_tag TEXT,
  year_tag TEXT,
  legal_status TEXT DEFAULT 'ترخيص ساري',
  price_sdg NUMERIC(16, 2),
  price_usd NUMERIC(12, 2),
  city TEXT NOT NULL DEFAULT 'الخرطوم',
  image_url TEXT,
  seller_phone TEXT,
  source_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified_dealer BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for pinned + fresh sorting and multi-facet filtering
CREATE INDEX IF NOT EXISTS idx_car_listings_active_feed
  ON public.car_listings (is_active, is_featured DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_car_listings_category
  ON public.car_listings (category);

CREATE INDEX IF NOT EXISTS idx_car_listings_city
  ON public.car_listings (city);

CREATE INDEX IF NOT EXISTS idx_car_listings_model_tag
  ON public.car_listings (model_tag);

CREATE INDEX IF NOT EXISTS idx_car_listings_source_seen
  ON public.car_listings (source_platform, last_seen_at);

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;

-- exchange_rates: Public read, service_role full access
DROP POLICY IF EXISTS "Public can read exchange_rates" ON public.exchange_rates;
CREATE POLICY "Public can read exchange_rates"
  ON public.exchange_rates
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role full access on exchange_rates" ON public.exchange_rates;
CREATE POLICY "Service role full access on exchange_rates"
  ON public.exchange_rates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- car_listings: Public read active listings (or all public read), public DirectUser insert, service_role full access
DROP POLICY IF EXISTS "Public can read active car_listings" ON public.car_listings;
CREATE POLICY "Public can read active car_listings"
  ON public.car_listings
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can insert DirectUser listings" ON public.car_listings;
CREATE POLICY "Public can insert DirectUser listings"
  ON public.car_listings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    source_platform = 'DirectUser'
    AND is_featured = false
    AND is_verified_dealer = false
    AND is_active = true
  );

DROP POLICY IF EXISTS "Service role full access on car_listings" ON public.car_listings;
CREATE POLICY "Service role full access on car_listings"
  ON public.car_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. Supabase Storage Bucket: car-images (Public, 5MB limit)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'car-images',
  'car-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies for car-images
DROP POLICY IF EXISTS "Public read access for car-images" ON storage.objects;
CREATE POLICY "Public read access for car-images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'car-images');

DROP POLICY IF EXISTS "Public upload access for car-images" ON storage.objects;
CREATE POLICY "Public upload access for car-images"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'car-images');

DROP POLICY IF EXISTS "Service role full access for car-images" ON storage.objects;
CREATE POLICY "Service role full access for car-images"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'car-images')
  WITH CHECK (bucket_id = 'car-images');
