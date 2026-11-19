import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://sudan-auto-index-o3rg.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "مرصد أسعار السيارات وقطع الغيار والآليات في السودان | Sudan Auto Index",
    template: "%s | مرصد أسعار السيارات في السودان",
  },
  description:
    "حاسبة السعر العادل وأحدث أسعار السيارات، البكاسي (هايلوكس)، التوسان، الجرارات والآليات الزراعية، وقطع الغيار في السودان بالجنيه السوداني والدولار الموازي المحدث لحظياً.",
  keywords: [
    "أسعار السيارات في السودان",
    "سعر تويوتا هايلوكس في السودان",
    "سعر هيونداي توسان في السودان",
    "دلالة السيارات السودان",
    "أسعار الجرارات الزراعية في السودان",
    "قطع غيار السيارات السودان",
    "حاسبة السعر العادل للسيارات",
    "سوق السيارات بورتسودان الخرطوم القضارف",
  ],
  verification: {
    google: "RuIOvIJ1RRQcVh1oztObRVEb7X4RUnA3oTS2-3DHvnA",
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "ar_SD",
    url: SITE_URL,
    siteName: "مرصد أسعار السيارات والآليات في السودان",
    title: "مرصد أسعار السيارات وقطع الغيار والآليات في السودان",
    description:
      "اعرف السعر العادل لسيارتك أو آليتك في السودان بالجنيه والدولار الموازي، وتصفح أحدث العروض المباشرة بدون وسطاء.",
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
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
