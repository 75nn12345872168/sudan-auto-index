import {
  CarFront,
  ShieldCheck,
  TrendingUp,
  HelpCircle,
  MessageSquareWarning,
} from "lucide-react";
import MarketWorkspace from "@/components/MarketWorkspace";
import { fetchInitialMarketData } from "@/lib/supabase";
import { PLATFORM_NAME, REPORT_WHATSAPP_NUMBER } from "@/lib/types";

export const revalidate = 300;

const FAQ_ITEMS = [
  {
    q: "كيف تحسب حاسبة السعر العادل قيمة السيارة أو الآلية في السودان؟",
    a: "تعتمد الحاسبة على الوسيط الإحصائي (Median) للإعلانات النشطة في قاعدة بيانات المرصد حسب الموديل وسنة الصنع والوضع القانوني (ترخيص ساري، أورنيك جمارك، بدون ورق)، مع التحويل المباشر بسعر الصرف الموازي المحدث.",
  },
  {
    q: "هل عرض سيارتي أو آليتي للبيع على المرصد مجاني؟",
    a: "نعم، العرض مجاني بالكامل لأصحاب المركبات والآليات عبر زر (صوّر واعرض سيارتك أو آليتك للبيع مجاناً) بدون تسجيل دخول، مع ضغط الصور تلقائياً لتعمل بسلاسة على شبكات الهاتف في السودان.",
  },
  {
    q: "كيف أتحقق من أن السعر المعروض حقيقي وليس إعلاناً مضللاً؟",
    a: "يرفض المرصد أي أرقام صغيرة مضللة ويعرض فقط الأسعار الواقعية بالجنيه السوداني، كما يتيح زر (إبلاغ / شكوى) على كل بطاقة لإبلاغ الإدارة فوراً عبر واتساب عن أي إعلان غير دقيق.",
  },
  {
    q: "ما هي المدن والمناطق المغطاة في المرصد؟",
    a: "يغطي المرصد أسواق السيارات والآليات الزراعية وقطع الغيار في بورتسودان، القضارف، عطبرة، أم درمان، الخرطوم، ود مدني، كسلا، دنقلا، الأبيض، وكوستي.",
  },
];

export default async function HomePage() {
  const { listings, exchangeRate, isLiveDatabase } =
    await fetchInitialMarketData();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Top Institutional Navigation & Live FX Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20">
              <CarFront className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-50 leading-tight">
                {PLATFORM_NAME}
              </h1>
              <p className="text-[11px] text-slate-400">
                Sudan Auto, Machinery &amp; Spare Parts Index
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-bold text-emerald-300 tabular-nums">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>
                الدولار الموازي:{" "}
                {new Intl.NumberFormat("en-US").format(
                  exchangeRate.parallel_rate
                )}{" "}
                ج.س
              </span>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
              {isLiveDatabase ? "متصل بقاعدة البيانات الحية" : "بيانات مرجعية نشطة"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-12">
        <MarketWorkspace
          initialListings={listings}
          parallelRate={exchangeRate.parallel_rate}
        />

        {/* FAQ Section */}
        <section
          aria-labelledby="faq-heading"
          className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-8 space-y-6"
        >
          <div className="flex items-center gap-2.5">
            <HelpCircle className="h-5 w-5 text-amber-400" />
            <h2
              id="faq-heading"
              className="text-xl sm:text-2xl font-extrabold text-slate-50"
            >
              الأسئلة الشائعة حول السوق والتسعير
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-4 space-y-2"
              >
                <h3 className="text-sm font-bold text-amber-300">{item.q}</h3>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 text-xs text-slate-400">
          <p>
            © {new Date().getFullYear()} {PLATFORM_NAME}. جميع الأسعار بالجنيه السوداني (ج.س) للاستدلال السوقي والتواصل المباشر.
          </p>
          <a
            href={`https://wa.me/${REPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
              `مرحباً إدارة ${PLATFORM_NAME}، أرغب في تمييز إعلان أو الإبلاغ عن ملاحظة.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-amber-400 hover:text-amber-300"
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            تواصل مع إدارة المرصد (تثبيت إعلان / شكاوى)
          </a>
        </div>
      </footer>
    </div>
  );
}
