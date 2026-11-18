"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Camera,
  ImagePlus,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  MIN_PARTS_PRICE_SDG,
  MIN_VEHICLE_PRICE_SDG,
  normalizeSudanPhone,
} from "@/lib/pricing";
import {
  CALCULATOR_MODELS,
  LEGAL_STATUSES,
  LISTING_CITIES,
  YEAR_RANGES,
  type CarListing,
  type LegalStatus,
  type ListingCategory,
  type YearRange,
} from "@/lib/types";

interface UploadListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  parallelRate: number;
  onListingCreated: (listing: CarListing) => void;
}

const UPLOAD_CATEGORIES: readonly ListingCategory[] = [
  "سيارات صالون",
  "بكاسي ودفع رباعي",
  "جرارات وآليات زراعية",
  "قطع غيار وإطارات",
];

/**
 * Compresses an image file client-side via HTML5 Canvas (maxWidth: 1000px, JPEG quality 0.78).
 */
async function compressImageToJpeg(file: File): Promise<Blob> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("تعذر قراءة الصورة المختارة"));
      el.src = imageUrl;
    });

    const maxWidth = 1000;
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("تعذر تهيئة أداة ضغط الصور");
    }
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.78)
    );
    if (!blob) {
      throw new Error("فشل ضغط الصورة");
    }
    return blob;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function UploadListingModal({
  isOpen,
  onClose,
  parallelRate,
  onListingCreated,
}: UploadListingModalProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<ListingCategory>("بكاسي ودفع رباعي");
  const [title, setTitle] = useState("");
  const [modelTag, setModelTag] = useState<string>("Toyota Hilux");
  const [yearTag, setYearTag] = useState<YearRange>("2013–2018");
  const [legalStatus, setLegalStatus] = useState<LegalStatus>("ترخيص ساري");
  const [city, setCity] = useState<string>("بورتسودان");
  const [priceInput, setPriceInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsCompressing(true);
    try {
      const blob = await compressImageToJpeg(file);
      setCompressedBlob(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "حدث خطأ أثناء معالجة الصورة"
      );
    } finally {
      setIsCompressing(false);
      e.target.value = "";
    }
  };

  const resetForm = () => {
    setTitle("");
    setPriceInput("");
    setPhoneInput("");
    setCompressedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 4) {
      setErrorMsg("يرجى كتابة عنوان واضح للسيارة أو الآلية (4 أحرف على الأقل).");
      return;
    }

    const normalizedPhone = normalizeSudanPhone(phoneInput);
    if (!normalizedPhone) {
      setErrorMsg(
        "يرجى إدخال رقم سوداني صحيح يبدأ بـ 09 أو 01 (مثال: 0912345678)."
      );
      return;
    }

    let priceSdg: number | null = null;
    if (priceInput.trim()) {
      const numeric = Number(
        priceInput
          .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
          .replace(/[^\d]/g, "")
      );
      const minThreshold =
        category === "قطع غيار وإطارات"
          ? MIN_PARTS_PRICE_SDG
          : MIN_VEHICLE_PRICE_SDG;
      if (!Number.isFinite(numeric) || numeric < minThreshold) {
        setErrorMsg(
          category === "قطع غيار وإطارات"
            ? "أقل سعر مسموح به لقطع الغيار هو 10,000 ج.س، أو اتركه فارغاً ليظهر (عند التواصل)."
            : "أقل سعر مسموح به للمركبات والآليات هو 500,000 ج.س، أو اتركه فارغاً ليظهر (عند التواصل)."
        );
        return;
      }
      priceSdg = numeric;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMsg(
        "قاعدة البيانات غير مربوطة بعد في هذا التشغيل المحلي (أضف مفاتيح Supabase في .env.local للنشر المباشر)."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadedImageUrl: string | null = null;
      const externalId = `direct-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      if (compressedBlob) {
        const filePath = `direct/${externalId}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("car-images")
          .upload(filePath, compressedBlob, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`فشل رفع الصورة: ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage
          .from("car-images")
          .getPublicUrl(filePath);
        uploadedImageUrl = publicData.publicUrl;
      }

      const priceUsd =
        priceSdg && parallelRate > 0 ? Math.round(priceSdg / parallelRate) : null;
      const nowIso = new Date().toISOString();

      const insertPayload = {
        external_id: externalId,
        source_platform: "DirectUser",
        category,
        title: trimmedTitle,
        model_tag: modelTag || null,
        year_tag: yearTag,
        legal_status: legalStatus,
        price_sdg: priceSdg,
        price_usd: priceUsd,
        city,
        image_url: uploadedImageUrl,
        seller_phone: normalizedPhone,
        source_url: null,
        is_featured: false,
        is_verified_dealer: false,
        is_active: true,
        last_seen_at: nowIso,
      };

      const { data: insertedRows, error: insertError } = await supabase
        .from("car_listings")
        .insert(insertPayload)
        .select("*")
        .limit(1);

      if (insertError) {
        throw new Error(`تعذر حفظ الإعلان: ${insertError.message}`);
      }

      const createdListing: CarListing = insertedRows?.[0]
        ? {
            ...insertedRows[0],
            price_sdg:
              insertedRows[0].price_sdg !== null
                ? Number(insertedRows[0].price_sdg)
                : null,
            price_usd:
              insertedRows[0].price_usd !== null
                ? Number(insertedRows[0].price_usd)
                : null,
          }
        : {
            id: externalId,
            ...insertPayload,
          };

      onListingCreated(createdListing);
      resetForm();
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء النشر."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-7 shadow-2xl my-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3
              id="upload-modal-title"
              className="text-lg sm:text-xl font-extrabold text-slate-50"
            >
              صوّر واعرض سيارتك أو آليتك للبيع مجاناً
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              نشر فوري بدون تسجيل دخول — يتم ضغط الصورة تلقائياً لتوفير بيانات الإنترنت.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="rounded-xl border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Image Capture & Gallery */}
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="space-y-3">
                <img
                  src={previewUrl}
                  alt="معاينة المركبة"
                  className="h-44 w-full rounded-xl object-cover border border-slate-800"
                />
                <div className="flex items-center justify-between text-xs text-emerald-400">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    تم ضغط الصورة بنجاح (
                    {compressedBlob
                      ? `${Math.round(compressedBlob.size / 1024)} كيلوبايت`
                      : ""}
                    )
                  </span>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="text-amber-300 hover:underline"
                  >
                    تغيير الصورة
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center py-2">
                <p className="text-xs font-medium text-slate-300">
                  أضف صورة واضحة للسيارة أو الآلية (تُضغط إلى عرض 1000px تلقائياً)
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={isCompressing}
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                  >
                    <Camera className="h-4 w-4" />
                    التقاط بالكاميرا
                  </button>
                  <button
                    type="button"
                    disabled={isCompressing}
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
                  >
                    <ImagePlus className="h-4 w-4" />
                    اختيار من المعرض
                  </button>
                </div>
                {isCompressing && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    جاري ضغط الصورة...
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                التصنيف
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ListingCategory)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-400"
              >
                {UPLOAD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                المدينة
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-400"
              >
                {LISTING_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                عنوان الإعلان (الماركة، الموديل، الحالة)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: تويوتا هايلوكس دبل كابين 2019 بحالة ممتازة"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                الموديل المرجعي (للحاسبة)
              </label>
              <select
                value={modelTag}
                onChange={(e) => setModelTag(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-400"
              >
                {CALCULATOR_MODELS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.labelAr}
                  </option>
                ))}
                <option value="">أخرى</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                نطاق السنة
              </label>
              <select
                value={yearTag}
                onChange={(e) => setYearTag(e.target.value as YearRange)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-400"
              >
                {YEAR_RANGES.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                الوضع القانوني
              </label>
              <select
                value={legalStatus}
                onChange={(e) => setLegalStatus(e.target.value as LegalStatus)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-400"
              >
                {LEGAL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                السعر المطلوب بالجنيه السوداني (ج.س)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="مثال: 48000000"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400 tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                رقم الواتساب / الهاتف السوداني (إلزامي للتواصل)
              </label>
              <input
                type="tel"
                required
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="09xxxxxxxx أو 01xxxxxxxx"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400 tabular-nums"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-medium text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              نشر العرض الآن مجاناً
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
