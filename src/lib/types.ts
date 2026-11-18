export type ListingCategory =
  | "سيارات صالون"
  | "بكاسي ودفع رباعي"
  | "جرارات وآليات زراعية"
  | "قطع غيار وإطارات";

export type LegalStatus = "ترخيص ساري" | "أورنيك جمارك" | "بدون ورق";

export type YearRange = "2005–2012" | "2013–2018" | "2019–2026";

export type CalculatorModelKey =
  | "Toyota Hilux"
  | "Toyota Land Cruiser"
  | "Hyundai Tucson"
  | "Hyundai Accent"
  | "Mitsubishi L200"
  | "Massey Ferguson Tractor"
  | "Combine Harvester"
  | "Spare Parts";

export interface CarListing {
  id: string;
  external_id: string;
  source_platform: string;
  category: ListingCategory | string;
  title: string;
  model_tag: string | null;
  year_tag: string | null;
  legal_status?: string | null;
  price_sdg: number | null;
  price_usd: number | null;
  city: string;
  image_url: string | null;
  seller_phone: string | null;
  source_url: string | null;
  is_featured: boolean;
  is_verified_dealer: boolean;
  is_active: boolean;
  last_seen_at: string;
  created_at?: string;
}

export interface ExchangeRate {
  parallel_rate: number;
  official_rate: number | null;
  source: string;
  updated_at: string;
}

export const SITE_URL = "https://sudan-auto-index.vercel.app";
export const PLATFORM_NAME = "مرصد أسعار السيارات وقطع الغيار والآليات في السودان";
export const REPORT_WHATSAPP_NUMBER = "249125939730";
export const DEFAULT_PARALLEL_RATE = 2650;

export const CATEGORIES: readonly ("الكل" | ListingCategory)[] = [
  "الكل",
  "سيارات صالون",
  "بكاسي ودفع رباعي",
  "جرارات وآليات زراعية",
  "قطع غيار وإطارات",
] as const;

export const CITIES: readonly string[] = [
  "الكل",
  "بورتسودان",
  "القضارف",
  "عطبرة",
  "أم درمان",
  "الخرطوم",
  "ود مدني",
  "كسلا",
  "دنقلا",
  "الأبيض",
  "كوستي",
] as const;

export const LISTING_CITIES: readonly string[] = CITIES.filter((c) => c !== "الكل");

export const YEAR_RANGES: readonly YearRange[] = [
  "2005–2012",
  "2013–2018",
  "2019–2026",
] as const;

export const LEGAL_STATUSES: readonly LegalStatus[] = [
  "ترخيص ساري",
  "أورنيك جمارك",
  "بدون ورق",
] as const;

export interface CalculatorModelOption {
  key: CalculatorModelKey;
  labelAr: string;
  category: ListingCategory;
  keywords: string[];
  baseUsdByYear: Record<YearRange, number>;
}

export const CALCULATOR_MODELS: readonly CalculatorModelOption[] = [
  {
    key: "Toyota Hilux",
    labelAr: "تويوتا هايلوكس (Hilux)",
    category: "بكاسي ودفع رباعي",
    keywords: ["هايلوكس", "هايلكس", "hilux"],
    baseUsdByYear: {
      "2005–2012": 13500,
      "2013–2018": 22500,
      "2019–2026": 34500,
    },
  },
  {
    key: "Toyota Land Cruiser",
    labelAr: "تويوتا لاندكروزر (Land Cruiser)",
    category: "بكاسي ودفع رباعي",
    keywords: ["لاندكروزر", "لاند كروزر", "land cruiser", "شاص"],
    baseUsdByYear: {
      "2005–2012": 24000,
      "2013–2018": 42000,
      "2019–2026": 68000,
    },
  },
  {
    key: "Hyundai Tucson",
    labelAr: "هيونداي توسان (Tucson)",
    category: "سيارات صالون",
    keywords: ["توسان", "tucson"],
    baseUsdByYear: {
      "2005–2012": 9200,
      "2013–2018": 15800,
      "2019–2026": 24500,
    },
  },
  {
    key: "Hyundai Accent",
    labelAr: "هيونداي أكسنت (Accent)",
    category: "سيارات صالون",
    keywords: ["أكسنت", "اكسنت", "accent"],
    baseUsdByYear: {
      "2005–2012": 6200,
      "2013–2018": 10200,
      "2019–2026": 15200,
    },
  },
  {
    key: "Mitsubishi L200",
    labelAr: "ميتسوبيشي L200 (Mitsubishi L200)",
    category: "بكاسي ودفع رباعي",
    keywords: ["l200", "ميتسوبيشي", "mitsubishi"],
    baseUsdByYear: {
      "2005–2012": 10500,
      "2013–2018": 17500,
      "2019–2026": 27000,
    },
  },
  {
    key: "Massey Ferguson Tractor",
    labelAr: "جرار ماسي فيرغسون (Massey Ferguson)",
    category: "جرارات وآليات زراعية",
    keywords: ["ماسي", "فيرغسون", "جرار", "massey", "tractor"],
    baseUsdByYear: {
      "2005–2012": 14500,
      "2013–2018": 23000,
      "2019–2026": 36000,
    },
  },
  {
    key: "Combine Harvester",
    labelAr: "حاصدة زراعية (Combine Harvester)",
    category: "جرارات وآليات زراعية",
    keywords: ["حاصدة", "حصادة", "harvester", "combine"],
    baseUsdByYear: {
      "2005–2012": 32000,
      "2013–2018": 54000,
      "2019–2026": 88000,
    },
  },
  {
    key: "Spare Parts",
    labelAr: "قطع غيار وإطارات (Spare Parts)",
    category: "قطع غيار وإطارات",
    keywords: ["قطع غيار", "اسبير", "إسبير", "إطار", "ماكينة", "spare"],
    baseUsdByYear: {
      "2005–2012": 220,
      "2013–2018": 340,
      "2019–2026": 480,
    },
  },
] as const;
