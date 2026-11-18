import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { PLATFORM_NAME, SITE_URL } from "@/lib/types";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${PLATFORM_NAME} | أسعار السيارات والجرارات وقطع الغيار بالجنيه السوداني`,
    template: `%s | ${PLATFORM_NAME}`,
  },
  description:
    "المنصة السودانية الأولى لمراقبة أسعار السيارات والبكاسي والآليات الزراعية وقطع الغيار في بورتسودان والقضارف وعطبرة وأم درمان والخرطوم، مع حاسبة السعر العادل بالجنيه السوداني والدولار.",
  keywords: [
    "أسعار السيارات في السودان",
    "سوق السيارات السودان",
    "تويوتا هايلوكس السودان",
    "هيونداي توسان السودان",
    "جرار زراعي ماسي فيرغسون السودان",
    "حاصدة زراعية القضارف",
    "قطع غيار سيارات السودان",
    "سوق بورتسودان للسيارات",
    "حاسبة السعر العادل للسيارات",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "ar_SD",
    url: SITE_URL,
    siteName: PLATFORM_NAME,
    title: `${PLATFORM_NAME} | حاسبة السعر العادل وعروض السودان المباشرة`,
    description:
      "اعرف السعر العادل لتويوتا هايلوكس ولاندكروزر وتوسان والجرارات الزراعية وقطع الغيار في السودان وتواصل مباشرة مع المالك عبر واتساب.",
  },
  twitter: {
    card: "summary_large_image",
    title: PLATFORM_NAME,
    description:
      "مؤشر حي لأسعار السيارات والآليات الزراعية وقطع الغيار في السودان بالجنيه السوداني.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const autoDealerJsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: PLATFORM_NAME,
    url: SITE_URL,
    description:
      "مرصد رقمي وسوق إلكتروني لأسعار السيارات والبكاسي والآليات الزراعية وقطع الغيار في السودان مع حاسبة السعر العادل.",
    areaServed: [
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
    ],
    priceRange: "SDG",
    telephone: "+249125939730",
  };

  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-screen bg-[#070b14] text-slate-50 antialiased selection:bg-amber-500/30 selection:text-amber-200">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(autoDealerJsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}
