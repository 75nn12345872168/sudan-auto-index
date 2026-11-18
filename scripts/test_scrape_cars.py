import unittest
from scripts.scrape_cars import (
    detect_category,
    detect_city,
    detect_model_tag,
    detect_year_tag,
    extract_listing_from_html,
    normalize_sudan_phone,
    parse_price,
)


class TestSudanAutoScraper(unittest.TestCase):
    def test_usd_conversion_and_minimum(self):
        # Valid USD >= 1000 converts to SDG using parallel_rate
        sdg, usd = parse_price(25000, currency_hint="USD", category="بكاسي ودفع رباعي", parallel_rate=2650)
        self.assertEqual(usd, 25000.0)
        self.assertEqual(sdg, 66250000.0)

        # Stray USD < 1000 rejected
        sdg2, usd2 = parse_price(500, currency_hint="USD", category="سيارات صالون", parallel_rate=2650)
        self.assertIsNone(sdg2)
        self.assertIsNone(usd2)

    def test_sdg_strict_thresholds(self):
        # Vehicle < 500,000 rejected
        sdg_low, _ = parse_price("150000", currency_hint="SDG", category="سيارات صالون", parallel_rate=2650)
        self.assertIsNone(sdg_low)

        # Vehicle >= 500,000 accepted (including Arabic shorthand مليون)
        sdg_ok, usd_ok = parse_price("45 مليون جنيه", category="سيارات صالون", parallel_rate=2650)
        self.assertEqual(sdg_ok, 45000000.0)
        self.assertAlmostEqual(usd_ok, 16981.13, places=2)

        # Spare parts >= 10,000 accepted, < 10,000 rejected
        parts_ok, _ = parse_price("125,000 ج.س", category="قطع غيار وإطارات", parallel_rate=2650)
        self.assertEqual(parts_ok, 125000.0)
        parts_low, _ = parse_price("5000 ج.س", category="قطع غيار وإطارات", parallel_rate=2650)
        self.assertIsNone(parts_low)

    def test_rejects_phone_mistaken_as_price(self):
        sdg, usd = parse_price("0912345678", category="سيارات صالون", parallel_rate=2650)
        self.assertIsNone(sdg)
        self.assertIsNone(usd)

    def test_phone_normalization(self):
        self.assertEqual(normalize_sudan_phone("0912345678"), "249912345678")
        self.assertEqual(normalize_sudan_phone("0125939730"), "249125939730")
        self.assertEqual(normalize_sudan_phone("+249 91-234-5678"), "249912345678")
        self.assertEqual(normalize_sudan_phone("٠٩١٢٣٤٥٦٧٨"), "249912345678")
        self.assertIsNone(normalize_sudan_phone("12345"))

    def test_city_detection(self):
        self.assertEqual(detect_city("تويوتا هايلوكس في بورتسودان"), "بورتسودان")
        self.assertEqual(detect_city("جرار زراعي القضارف"), "القضارف")
        self.assertEqual(detect_city("توسان 2017 ام درمان"), "أم درمان")
        self.assertEqual(detect_city("عرض في مدني"), "ود مدني")
        self.assertEqual(detect_city("سيارة نظيفة جدا"), "الخرطوم")

    def test_classification_and_html_extraction(self):
        sample_html = """
        <html lang="ar">
        <head>
          <title>تويوتا هايلوكس 2020 للبيع - السوق المفتوح</title>
          <meta property="og:title" content="تويوتا هايلوكس 2020 في عطبرة - السوق المفتوح" />
          <meta property="og:image" content="https://example.com/hilux.jpg" />
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Vehicle",
            "name": "تويوتا هايلوكس 2020 دبل كابين",
            "offers": {
              "@type": "Offer",
              "price": "32000",
              "priceCurrency": "USD",
              "seller": { "telephone": "0912345678" }
            }
          }
          </script>
        </head>
        <body><p>ترخيص ساري في عطبرة للتواصل 0912345678</p></body>
        </html>
        """
        rec = extract_listing_from_html(
            sample_html,
            "https://sd.opensooq.com/ar/search/12345678",
            "بكاسي ودفع رباعي",
            2650.0,
        )
        self.assertIsNotNone(rec)
        assert rec is not None
        self.assertEqual(rec["external_id"], "opensooq-12345678")
        self.assertEqual(rec["category"], "بكاسي ودفع رباعي")
        self.assertEqual(rec["model_tag"], "Toyota Hilux")
        self.assertEqual(rec["year_tag"], "2019–2026")
        self.assertEqual(rec["city"], "عطبرة")
        self.assertEqual(rec["seller_phone"], "249912345678")
        self.assertEqual(rec["price_usd"], 32000.0)
        self.assertEqual(rec["price_sdg"], 84800000.0)
        self.assertEqual(rec["image_url"], "https://example.com/hilux.jpg")

        self.assertEqual(detect_category("جرار ماسي فيرغسون"), "جرارات وآليات زراعية")
        self.assertEqual(detect_model_tag("حاصدة زراعية كلاس", "جرارات وآليات زراعية"), "Combine Harvester")
        self.assertEqual(detect_year_tag("توسان 2016"), "2013–2018")


if __name__ == "__main__":
    unittest.main()
