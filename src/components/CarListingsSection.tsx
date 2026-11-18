"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Car,
  Clock,
  Flag,
  MapPin,
  MessageCircle,
  Pin,
  Plus,
  Search,
  Share2,
  Tractor,
  Wrench,
  ExternalLink,
} from "lucide-react";
import {
  formatRelativeTimeAr,
  formatSdgPrice,
  isValidSdgPrice,
} from "@/lib/pricing";
import {
  CATEGORIES,
  CITIES,
  PLATFORM_NAME,
  REPORT_WHATSAPP_NUMBER,
  SITE_URL,
  type CarListing,
} from "@/lib/types";

interface CarListingsSectionProps {
  listings: CarListing[];
  onOpenUploadModal: () => void;
}

function CategoryFallbackVisual({ category }: { category: string }) {
  const Icon =
    category === "جرارات وآليات زراعية"
      ? Tractor
      : category === "قطع غيار وإطارات"
      ? Wrench
      : Car;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-slate-500">
      <Icon className="h-11 w-11 text-amber-500/70" />
      <span className="text-[11px] font-medium text-slate-400">{category}</span>
    </div>
  );
}

export default function CarListingsSection({
  listings,
  onOpenUploadModal,
}: CarListingsSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("الكل");
  const [selectedCity, setSelectedCity] = useState<string>("الكل");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return listings
      .filter((item) => item.is_active)
      .filter(
        (item) =>
          selectedCategory === "الكل" || item.category === selectedCategory
      )
      .filter((item) => selectedCity === "الكل" || item.city === selectedCity)
      .filter((item) => {
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          (item.model_tag ?? "").toLowerCase().includes(q) ||
          item.city.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.is_featured !== b.is_featured) {
          return a.is_featured ? -1 : 1;
        }
        return (
          new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
        );
      });
  }, [listings, selectedCategory, selectedCity, searchQuery]);

  return (
    <section id="listings" aria-labelledby="listings-heading" className="space-y-6">
      {/* Section Header & Upload CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
            <Pin className="h-3.5 w-3.5" />
            عروض السودان المباشرة — المثبتة والمحدثة آلياً
          </div>
          <h2
            id="listings-heading"
            className="text-2xl sm:text-3xl font-extrabold text-slate-50"
          >
            أحدث عروض السيارات والآليات وقطع الغيار
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenUploadModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-500 to-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 transition cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          صوّر واعرض سيارتك أو آليتك للبيع مجاناً
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-4">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="تصفية حسب الفئة">
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition ${
                  active
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "border border-slate-700/80 bg-slate-950/70 text-slate-300 hover:border-slate-600 hover:text-white"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* City Pills + Search */}
        <div className="grid gap-3 md:grid-cols-12 md:items-center">
          <div className="md:col-span-8 flex flex-wrap gap-1.5">
            {CITIES.map((city) => {
              const active = selectedCity === city;
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => setSelectedCity(city)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-950/60 text-slate-400 border border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {city !== "الكل" && <MapPin className="h-3 w-3" />}
                  {city}
                </button>
              );
            })}
          </div>

          <div className="md:col-span-4 relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالموديل أو المواصفات..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pr-9 pl-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          يتم عرض{" "}
          <strong className="text-slate-200 tabular-nums">
            {filteredListings.length}
          </strong>{" "}
          عرض نشط
        </span>
        <span>الترتيب: الإعلانات المميزة أولاً ثم الأحدث</span>
      </div>

      {/* Listings Grid */}
      {filteredListings.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-10 text-center space-y-3">
          <p className="text-base font-bold text-slate-200">
            لا توجد عروض مطابقة حالياً في هذا التصنيف أو المدينة.
          </p>
          <p className="text-xs text-slate-400">
            جرّب اختيار &quot;الكل&quot; أو أضف إعلانك مباشرة مجاناً.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("الكل");
              setSelectedCity("الكل");
              setSearchQuery("");
            }}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
          >
            إعادة ضبط الفلاتر
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((item) => {
            const hasValidPrice = isValidSdgPrice(item.price_sdg, item.category);
            const displayPrice = formatSdgPrice(item.price_sdg, item.category);

            const ownerMessage = encodeURIComponent(
              `السلام عليكم، شاهدت عرضك (${item.title}) بسعر (${displayPrice}) في مدينة ${item.city} عبر ${PLATFORM_NAME}. هل العرض لا يزال متاحاً؟`
            );

            const shareMessage = encodeURIComponent(
              `شاهد هذا العرض على ${PLATFORM_NAME}:\n${item.title}\nالسعر: ${displayPrice}\nالمدينة: ${item.city}\n${SITE_URL}`
            );

            const reportMessage = encodeURIComponent(
              `إبلاغ / شكوى حول إعلان:\nرقم الإعلان: ${item.id}\nالعنوان: ${item.title}\nالمدينة: ${item.city}`
            );

            const whatsappOwnerHref = item.seller_phone
              ? `https://wa.me/${item.seller_phone}?text=${ownerMessage}`
              : null;

            const shareHref = `https://wa.me/?text=${shareMessage}`;
            const reportHref = `https://wa.me/${REPORT_WHATSAPP_NUMBER}?text=${reportMessage}`;

            return (
              <article
                key={item.id}
                className={`group flex flex-col overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 ${
                  item.is_featured
                    ? "border-amber-500/50 bg-gradient-to-b from-slate-900 to-slate-950 shadow-lg shadow-amber-500/10"
                    : "border-slate-800 bg-slate-900/90 hover:border-slate-700"
                }`}
              >
                {/* Card Media */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <CategoryFallbackVisual category={item.category} />
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 right-3 left-3 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {item.is_featured && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 shadow">
                          <Pin className="h-3 w-3" />
                          إعلان مميز
                        </span>
                      )}
                      {item.is_verified_dealer && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          معرض موثق
                        </span>
                      )}
                      {item.source_platform === "DirectUser" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow">
                          من المالك مباشرة
                        </span>
                      )}
                    </div>

                    <span className="rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] font-semibold text-slate-200 backdrop-blur">
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-4 space-y-4">
                  <div className="space-y-2.5">
                    <h3 className="line-clamp-2 text-base font-bold text-slate-50 leading-snug">
                      {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-0.5 text-slate-200">
                        <MapPin className="h-3 w-3 text-amber-400" />
                        {item.city}
                      </span>
                      {item.year_tag && (
                        <span className="rounded-md bg-slate-800/80 px-2 py-0.5 tabular-nums text-slate-300">
                          {item.year_tag}
                        </span>
                      )}
                      {item.legal_status && (
                        <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-slate-300">
                          {item.legal_status}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTimeAr(item.last_seen_at)}
                      </span>
                    </div>

                    {/* Strict SDG Pricing */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5">
                      <div
                        className={`tabular-nums font-extrabold ${
                          hasValidPrice
                            ? "text-lg text-amber-400"
                            : "text-sm text-slate-300"
                        }`}
                      >
                        {displayPrice}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="space-y-2 pt-1">
                    {whatsappOwnerHref ? (
                      <a
                        href={whatsappOwnerHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-950 hover:bg-emerald-400 transition"
                      >
                        <MessageCircle className="h-4 w-4" />
                        تواصل مباشر مع المالك - واتساب
                      </a>
                    ) : item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-emerald-300 hover:bg-emerald-600/30 transition"
                      >
                        <ExternalLink className="h-4 w-4" />
                        تواصل عبر رابط الإعلان الأصلي
                      </a>
                    ) : (
                      <a
                        href={reportHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition"
                      >
                        <MessageCircle className="h-4 w-4" />
                        استفسر عبر إدارة المرصد - واتساب
                      </a>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={shareHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400/50 hover:text-amber-300 transition"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        مشاركة العرض
                      </a>

                      <a
                        href={reportHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-rose-500/40 hover:text-rose-300 transition"
                      >
                        <Flag className="h-3.5 w-3.5" />
                        إبلاغ / شكوى
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
