import {
  CALCULATOR_MODELS,
  type CalculatorModelKey,
  type CarListing,
  type LegalStatus,
  type YearRange,
} from "./types";

export const MIN_VEHICLE_PRICE_SDG = 500_000;
export const MIN_PARTS_PRICE_SDG = 10_000;
export const NO_PRICE_LABEL = "السعر عند التواصل مع المالك";

const LEGAL_STATUS_MULTIPLIER: Record<LegalStatus, number> = {
  "ترخيص ساري": 1.0,
  "أورنيك جمارك": 0.85,
  "بدون ورق": 0.68,
};

const YEAR_MULTIPLIER: Record<YearRange, number> = {
  "2005–2012": 0.62,
  "2013–2018": 1.0,
  "2019–2026": 1.48,
};

/**
 * Validates that an SDG price passes minimum thresholds:
 * >= 500,000 SDG for vehicles/machinery, >= 10,000 SDG for spare parts.
 */
export function isValidSdgPrice(
  priceSdg: number | null | undefined,
  category?: string | null
): priceSdg is number {
  if (typeof priceSdg !== "number" || !Number.isFinite(priceSdg) || priceSdg <= 0) {
    return false;
  }
  const minThreshold =
    category === "قطع غيار وإطارات" ? MIN_PARTS_PRICE_SDG : MIN_VEHICLE_PRICE_SDG;
  return priceSdg >= minThreshold;
}

/**
 * Formats an SDG price strictly in Sudanese Pounds or returns the contact label.
 */
export function formatSdgPrice(
  priceSdg: number | null | undefined,
  category?: string | null
): string {
  if (!isValidSdgPrice(priceSdg, category)) {
    return NO_PRICE_LABEL;
  }
  const rounded = Math.round(priceSdg);
  return `${new Intl.NumberFormat("en-US").format(rounded)} ج.س`;
}

export function formatUsdPrice(priceUsd: number | null | undefined): string | null {
  if (typeof priceUsd !== "number" || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    return null;
  }
  return `$${new Intl.NumberFormat("en-US").format(Math.round(priceUsd))}`;
}

/**
 * Normalizes Sudanese phone numbers (09xxxxxxxx or 01xxxxxxxx or +249...) to 249xxxxxxxxx.
 */
export function normalizeSudanPhone(raw: string): string | null {
  const arabicToAscii = raw.replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d))
  );
  const digits = arabicToAscii.replace(/\D/g, "");
  let normalized = digits;

  if (normalized.startsWith("00249")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("0") && normalized.length === 10) {
    normalized = `249${normalized.slice(1)}`;
  } else if (
    (normalized.startsWith("9") || normalized.startsWith("1")) &&
    normalized.length === 9
  ) {
    normalized = `249${normalized}`;
  }

  if (/^249[91]\d{8}$/.test(normalized)) {
    return normalized;
  }
  return null;
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface FairPriceResult {
  medianSdg: number;
  medianUsd: number;
  minSdg: number;
  maxSdg: number;
  sampleCount: number;
  matchScope: "exact" | "model-adjusted" | "market-benchmark";
}

/**
 * Computes Median Fair Price in SDG & USD from live car_listings in memory,
 * progressively adjusting for year range & legal status when exact subset is sparse.
 */
export function calculateFairPrice(params: {
  listings: CarListing[];
  modelKey: CalculatorModelKey;
  yearRange: YearRange;
  legalStatus: LegalStatus;
  parallelRate: number;
}): FairPriceResult {
  const { listings, modelKey, yearRange, legalStatus, parallelRate } = params;
  const modelMeta =
    CALCULATOR_MODELS.find((m) => m.key === modelKey) ?? CALCULATOR_MODELS[0];
  const safeRate = parallelRate > 0 ? parallelRate : 2650;

  const modelMatches = listings.filter((item) => {
    if (!item.is_active || !isValidSdgPrice(item.price_sdg, item.category)) {
      return false;
    }
    if (item.model_tag) {
      return item.model_tag.toLowerCase() === modelKey.toLowerCase();
    }
    if (modelKey !== "Spare Parts" && item.category === "قطع غيار وإطارات") {
      return false;
    }
    const haystack = `${item.title} ${item.category}`.toLowerCase();
    return modelMeta.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
  });

  // 1. Exact match on model + yearRange + legalStatus
  const exactMatches = modelMatches.filter(
    (item) =>
      item.year_tag === yearRange &&
      (!item.legal_status || item.legal_status === legalStatus)
  );

  // If we have exact matches with matching legalStatus specifically
  const strictLegalExact = modelMatches.filter(
    (item) => item.year_tag === yearRange && item.legal_status === legalStatus
  );

  if (strictLegalExact.length >= 1) {
    const prices = strictLegalExact.map((i) => i.price_sdg as number);
    const medianSdg = Math.round(computeMedian(prices));
    return {
      medianSdg,
      medianUsd: Math.round(medianSdg / safeRate),
      minSdg: Math.round(Math.min(...prices) * 0.94),
      maxSdg: Math.round(Math.max(...prices) * 1.06),
      sampleCount: strictLegalExact.length,
      matchScope: "exact",
    };
  }

  // 2. Same model + yearRange, adjust for legalStatus differential
  if (exactMatches.length >= 1) {
    const adjustedPrices = exactMatches.map((item) => {
      const itemLegal = (item.legal_status as LegalStatus) || "ترخيص ساري";
      const itemFactor = LEGAL_STATUS_MULTIPLIER[itemLegal] ?? 1.0;
      const targetFactor = LEGAL_STATUS_MULTIPLIER[legalStatus];
      return ((item.price_sdg as number) / itemFactor) * targetFactor;
    });
    const medianSdg = Math.round(computeMedian(adjustedPrices));
    return {
      medianSdg,
      medianUsd: Math.round(medianSdg / safeRate),
      minSdg: Math.round(medianSdg * 0.9),
      maxSdg: Math.round(medianSdg * 1.1),
      sampleCount: exactMatches.length,
      matchScope: "model-adjusted",
    };
  }

  // 3. Same model across other years, adjust by year + legal ratios
  if (modelMatches.length >= 1) {
    const adjustedPrices = modelMatches.map((item) => {
      const itemYear = (item.year_tag as YearRange) || "2013–2018";
      const itemLegal = (item.legal_status as LegalStatus) || "ترخيص ساري";
      const yearRatio =
        (YEAR_MULTIPLIER[yearRange] ?? 1) / (YEAR_MULTIPLIER[itemYear] ?? 1);
      const legalRatio =
        (LEGAL_STATUS_MULTIPLIER[legalStatus] ?? 1) /
        (LEGAL_STATUS_MULTIPLIER[itemLegal] ?? 1);
      return (item.price_sdg as number) * yearRatio * legalRatio;
    });
    const medianSdg = Math.round(computeMedian(adjustedPrices));
    return {
      medianSdg,
      medianUsd: Math.round(medianSdg / safeRate),
      minSdg: Math.round(medianSdg * 0.88),
      maxSdg: Math.round(medianSdg * 1.12),
      sampleCount: modelMatches.length,
      matchScope: "model-adjusted",
    };
  }

  // 4. Calibrated Sudan market USD benchmark converted at live parallel FX rate
  const baseUsd = modelMeta.baseUsdByYear[yearRange];
  const adjustedUsd = Math.round(baseUsd * LEGAL_STATUS_MULTIPLIER[legalStatus]);
  const medianSdg = Math.round(adjustedUsd * safeRate);
  return {
    medianSdg,
    medianUsd: adjustedUsd,
    minSdg: Math.round(medianSdg * 0.9),
    maxSdg: Math.round(medianSdg * 1.1),
    sampleCount: 0,
    matchScope: "market-benchmark",
  };
}

export interface OfferEvaluation {
  status: "deal" | "fair" | "overpriced";
  label: string;
  diffPercent: number;
  diffSdg: number;
}

export function evaluateOfferPrice(
  offeredSdg: number,
  medianSdg: number
): OfferEvaluation | null {
  if (!Number.isFinite(offeredSdg) || offeredSdg <= 0 || medianSdg <= 0) {
    return null;
  }
  const diffSdg = offeredSdg - medianSdg;
  const diffRatio = diffSdg / medianSdg;
  const diffPercent = Math.round(diffRatio * 100);

  if (diffRatio <= -0.08) {
    return {
      status: "deal",
      label: "صفقة ممتازة (أقل من السوق)",
      diffPercent,
      diffSdg,
    };
  }
  if (diffRatio <= 0.1) {
    return {
      status: "fair",
      label: "سعر عادل",
      diffPercent,
      diffSdg,
    };
  }
  return {
    status: "overpriced",
    label: "مبالغ فيه (أعلى من السوق)",
    diffPercent,
    diffSdg,
  };
}

export function formatRelativeTimeAr(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "حديثاً";
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "قبل أقل من ساعة";
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "منذ يوم واحد";
  if (diffDays <= 10) return `منذ ${diffDays} أيام`;
  return `منذ ${diffDays} يوماً`;
}
