"use client";

import { useMemo, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Scale,
  DollarSign,
  Database,
} from "lucide-react";
import {
  CALCULATOR_MODELS,
  LEGAL_STATUSES,
  YEAR_RANGES,
  type CalculatorModelKey,
  type CarListing,
  type LegalStatus,
  type YearRange,
} from "@/lib/types";
import {
  calculateFairPrice,
  evaluateOfferPrice,
  formatSdgPrice,
  formatUsdPrice,
} from "@/lib/pricing";

interface FairPriceCalculatorProps {
  listings: CarListing[];
  parallelRate: number;
}

export default function FairPriceCalculator({
  listings,
  parallelRate,
}: FairPriceCalculatorProps) {
  const [selectedModel, setSelectedModel] =
    useState<CalculatorModelKey>("Toyota Hilux");
  const [selectedYear, setSelectedYear] = useState<YearRange>("2013–2018");
  const [selectedLegalStatus, setSelectedLegalStatus] =
    useState<LegalStatus>("ترخيص ساري");
  const [offeredPriceRaw, setOfferedPriceRaw] = useState<string>("");

  const modelOption = useMemo(
    () =>
      CALCULATOR_MODELS.find((m) => m.key === selectedModel) ??
      CALCULATOR_MODELS[0],
    [selectedModel]
  );

  const fairPrice = useMemo(
    () =>
      calculateFairPrice({
        listings,
        modelKey: selectedModel,
        yearRange: selectedYear,
        legalStatus: selectedLegalStatus,
        parallelRate,
      }),
    [listings, selectedModel, selectedYear, selectedLegalStatus, parallelRate]
  );

  const parsedOfferedPrice = useMemo(() => {
    const ascii = offeredPriceRaw
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[^\d.]/g, "");
    if (!ascii) return NaN;
    return Number(ascii);
  }, [offeredPriceRaw]);

  const evaluation = useMemo(
    () => evaluateOfferPrice(parsedOfferedPrice, fairPrice.medianSdg),
    [parsedOfferedPrice, fairPrice.medianSdg]
  );

  return (
    <section
      aria-labelledby="fair-price-calc-title"
      className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 sm:p-8 shadow-2xl shadow-black/50"
    >
      {/* Subtle financial grid accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="relative z-10 grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left / Controls Column */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              <Calculator className="h-3.5 w-3.5" />
              تقييم فوري لأسعار السوق السوداني
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 tabular-nums">
              <DollarSign className="h-3.5 w-3.5" />
              سعر الصرف الموازي: {new Intl.NumberFormat("en-US").format(parallelRate)} ج.س / $
            </span>
          </div>

          <div>
            <h2
              id="fair-price-calc-title"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-50"
            >
              حاسبة السعر العادل للسيارة والآليات
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-slate-300 leading-relaxed">
              قارن السعر المطلوب بمتوسط السوق الحي في السودان (بالجنيه السوداني والدولار) قبل الشراء أو التفاوض.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Model Select */}
            <div className="sm:col-span-3">
              <label
                htmlFor="calc-model"
                className="mb-1.5 block text-xs font-semibold text-slate-300"
              >
                الفئة / الموديل
              </label>
              <select
                id="calc-model"
                value={selectedModel}
                onChange={(e) =>
                  setSelectedModel(e.target.value as CalculatorModelKey)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm font-medium text-slate-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              >
                {CALCULATOR_MODELS.map((model) => (
                  <option key={model.key} value={model.key}>
                    {model.labelAr} — {model.category}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Range */}
            <div>
              <label
                htmlFor="calc-year"
                className="mb-1.5 block text-xs font-semibold text-slate-300"
              >
                سنة الصنع
              </label>
              <select
                id="calc-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value as YearRange)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2.5 text-sm font-medium text-slate-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              >
                {YEAR_RANGES.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Legal Status */}
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                الوضع القانوني والترخيص
              </span>
              <div className="grid grid-cols-3 gap-2">
                {LEGAL_STATUSES.map((status) => {
                  const active = selectedLegalStatus === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedLegalStatus(status)}
                      className={`rounded-xl border px-2.5 py-2.5 text-xs font-semibold transition ${
                        active
                          ? "border-amber-400 bg-amber-500/20 text-amber-200 shadow-sm"
                          : "border-slate-700/80 bg-slate-950/70 text-slate-300 hover:border-slate-600 hover:text-white"
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Optional Offered Price Evaluator */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <label
              htmlFor="offered-price-input"
              className="mb-2 block text-xs font-semibold text-amber-300"
            >
              أدخل السعر المعروض عليك (بالجنيه السوداني - اختياري)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="offered-price-input"
                type="text"
                inputMode="numeric"
                value={offeredPriceRaw}
                onChange={(e) => setOfferedPriceRaw(e.target.value)}
                placeholder="مثال: 45000000"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 tabular-nums"
              />
              {offeredPriceRaw && (
                <button
                  type="button"
                  onClick={() => setOfferedPriceRaw("")}
                  className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  مسح
                </button>
              )}
            </div>

            {evaluation && (
              <div
                className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold ${
                  evaluation.status === "deal"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : evaluation.status === "fair"
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                    : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {evaluation.status === "deal" ? (
                    <TrendingDown className="h-4 w-4 shrink-0" />
                  ) : evaluation.status === "fair" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <TrendingUp className="h-4 w-4 shrink-0" />
                  )}
                  {evaluation.label}
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  {evaluation.diffPercent > 0
                    ? `+${evaluation.diffPercent}% فوق الوسيط`
                    : `${evaluation.diffPercent}% عن الوسيط`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right / Valuation Output Card */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-700/80 bg-slate-950/90 p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Scale className="h-4 w-4 text-amber-400" />
                الوسيط العادل للسوق (Median)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                <Database className="h-3 w-3 text-emerald-400" />
                {fairPrice.sampleCount > 0
                  ? `من ${fairPrice.sampleCount} إعلان حي`
                  : "مؤشر السوق المرجعي"}
              </span>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-transparent p-4">
              <p className="text-xs text-slate-400 mb-1">
                {modelOption.labelAr} • {selectedYear} • {selectedLegalStatus}
              </p>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">
                {formatSdgPrice(fairPrice.medianSdg, modelOption.category)}
              </div>
              <div className="mt-1.5 text-sm font-semibold text-emerald-400 tabular-nums">
                المعادل التقريبي: {formatUsdPrice(fairPrice.medianUsd)} دولار أمريكي
              </div>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-slate-800 pt-4 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span>نطاق التداول العادل:</span>
              <span className="font-bold text-slate-100 tabular-nums">
                {new Intl.NumberFormat("en-US").format(fairPrice.minSdg)} –{" "}
                {new Intl.NumberFormat("en-US").format(fairPrice.maxSdg)} ج.س
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>معامل الصرف المعتمد:</span>
              <span className="tabular-nums text-slate-300">
                1 USD = {new Intl.NumberFormat("en-US").format(parallelRate)} SDG
              </span>
            </div>
            <p className="pt-1 text-[11px] leading-relaxed text-slate-400">
              يُحسب الوسيط تلقائياً من الإعلانات النشطة في ذاكرة المرصد مع مراعاة فرق الترخيص والجمارك.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
