#!/usr/bin/env python3
"""
Sudan Auto Index — Automated OpenSooq Sudan Scraper & FX Sync Engine
Scrapes vehicles, agricultural machinery, and spare parts from sd.opensooq.com,
filters out real estate/irrelevant ads and generic site logos, converts USD prices
using Supabase exchange_rates, normalizes Sudanese phone numbers & cities,
upserts into car_listings, cleans polluted rows, and deactivates stale ads (>36h).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import quote_plus, urljoin

import requests
from bs4 import BeautifulSoup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("sudan-auto-scraper")

BASE_URL = "https://sd.opensooq.com"
DEFAULT_PARALLEL_RATE = 2650.0
STALE_HOURS = 36

# البحث داخل قسم السيارات والمركبات وقطع الغيار والآليات الثقيلة مباشرة
TARGET_QUERIES: list[tuple[str, str, str]] = [
    ("تويوتا هايلوكس", f"{BASE_URL}/ar/سيارات-ومركبات/سيارات-للبيع?term={quote_plus('هايلوكس')}", "بكاسي ودفع رباعي"),
    ("هيونداي توسان", f"{BASE_URL}/ar/سيارات-ومركبات/سيارات-للبيع?term={quote_plus('توسان')}", "سيارات صالون"),
    ("سيارات للبيع", f"{BASE_URL}/ar/سيارات-ومركبات/سيارات-للبيع", "سيارات صالون"),
    ("شاحنات وآليات ثقيلة", f"{BASE_URL}/ar/سيارات-ومركبات/شاحنات-واليات-ثقيلة", "جرارات وآليات زراعية"),
    ("قطع غيار سيارات", f"{BASE_URL}/ar/سيارات-ومركبات/قطع-غيار-اكسسوارات", "قطع غيار وإطارات"),
]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩٫٬", "0123456789.,")

EXCLUDE_WORDS: tuple[str, ...] = (
    "قطعة ارض", "قطعة أرض", "ارض للبيع", "أرض للبيع", "اراضي", "أراضي",
    "شقة", "شقق", "منزل", "بيوت", "عمارة", "فيلا", "مزرعة", "دكان", "مخزن",
    "عقار", "عقارات", "متر مربع", "م2", "ناصية", "شهادة بحث", "درجة اولى",
    "درجة أولى", "ايجار", "إيجار", "وظيفة", "مطلوب موظف", "ايفون", "آيفون",
    "سامسونج", "لابتوب", "شاشة", "اثاث", "أثاث", "غرفة نوم", "مطبخ",
)

INCLUDE_WORDS: tuple[str, ...] = (
    "سيارة", "سيارات", "مركبة", "تويوتا", "هايلوكس", "هايلكس", "لاندكروزر",
    "لاند كروزر", "كورولا", "كامري", "برادو", "فورتشنر", "شاص", "يارس",
    "هيونداي", "توسان", "اكسنت", "أكسنت", "النترا", "سوناتا", "سنتافي", "كريتا",
    "كيا", "سبورتاج", "ريو", "سيراتو", "سورينتو", "نيسان", "باترول", "صني",
    "نافارا", "ميتسوبيشي", "لانسر", "باجيرو", "l200", "شاحنة", "بوكس", "حافلة",
    "دفار", "قلاية", "جرار", "حاصدة", "حصادة", "تراكتور", "معدات", "آليات",
    "اليات", "ماسي", "فيرغسون", "قطع غيار", "اسبير", "إسبير", "اطارات",
    "إطارات", "ماكينة", "مكينة", "جيربوكس", "قير", "بطارية", "رديتر", "كفرات",
    "جنوط", "فانوس", "طلمبة", "hilux", "land cruiser", "tucson", "accent",
    "tractor", "harvester", "car", "auto", "spare",
)

BAD_IMAGE_TOKENS: tuple[str, ...] = (
    "logo", "og-image", "og_image", "opensooq-logo", "default", "placeholder",
    "no-image", "noimage", "favicon", "brand", "banner", "avatar", "icon",
)

CITY_ALIASES: list[tuple[str, tuple[str, ...]]] = [
    ("بورتسودان", ("بورتسودان", "بورت سودان", "port sudan", "portsudan")),
    ("القضارف", ("القضارف", "قضارف", "gedaref", "qadarif", "al qadarif")),
    ("عطبرة", ("عطبرة", "عطبره", "atbara")),
    ("أم درمان", ("أم درمان", "ام درمان", "أمدرمان", "امدرمان", "omdurman")),
    ("ود مدني", ("ود مدني", "ودمدني", "مدني", "wad madani", "wad medani")),
    ("كسلا", ("كسلا", "kassala")),
    ("دنقلا", ("دنقلا", "dongola")),
    ("الأبيض", ("الأبيض", "الابيض", "el obeid", "al-ubayyid")),
    ("كوستي", ("كوستي", "kosti")),
    ("الخرطوم", ("الخرطوم", "بحري", "الخرطوم بحري", "شرق النيل", "khartoum", "bahri")),
]

MIN_VEHICLE_PRICE_SDG = 500_000
MIN_PARTS_PRICE_SDG = 10_000
MAX_SANE_PRICE_SDG = 5_000_000_000
MIN_USD_PRICE = 1_000


def to_ascii_digits(text: str) -> str:
    """Convert Arabic-Indic numerals and punctuation to ASCII."""
    return (text or "").translate(ARABIC_DIGITS)


def is_valid_auto_listing(title: str, source_url: str = "") -> bool:
    """Ensure the listing is genuinely about vehicles, machinery, or spare parts."""
    normalized = to_ascii_digits(title or "").strip().lower()
    if not normalized or len(normalized) < 4:
        return False
    # استبعاد روابط البحث العامة التي لا تشير لإعلان فردي
    if "/ar/search/" in (source_url or "") or "?term=" in (source_url or ""):
        return False
    # استبعاد العقارات والإعلانات غير المتعلقة بالسيارات
    if any(bad in normalized for bad in EXCLUDE_WORDS):
        return False
    # اشتراط وجود كلمة مفتاحية مرتبطة بالمركبات أو الآليات أو قطع الغيار
    if not any(good in normalized for good in INCLUDE_WORDS):
        return False
    return True


def clean_image_url(raw_url: Optional[str]) -> Optional[str]:
    """Filter out generic OpenSooq logos, placeholders, and invalid image URLs."""
    if not raw_url:
        return None
    url = raw_url.strip()
    if not url.startswith(("http://", "https://")):
        return None
    lowered = url.lower()
    if any(token in lowered for token in BAD_IMAGE_TOKENS):
        return None
    return url


def normalize_sudan_phone(raw: Optional[str]) -> Optional[str]:
    """
    Normalize Sudanese phone numbers to 2499xxxxxxxx or 2491xxxxxxxx (12 digits).
    Accepts 09xxxxxxxx, 01xxxxxxxx, +249xxxxxxxxx, 00249xxxxxxxxx, 249xxxxxxxxx.
    """
    if not raw:
        return None
    cleaned = to_ascii_digits(raw)
    candidates = re.findall(r"(?:\+?249|00249|0)?[\s\-]*(9\d(?:[\s\-]*\d){7}|1\d(?:[\s\-]*\d){7})", cleaned)
    for match in candidates:
        digits = re.sub(r"\D", "", match)
        if len(digits) == 9 and digits[0] in ("9", "1"):
            return f"249{digits}"

    digits_only = re.sub(r"\D", "", cleaned)
    if digits_only.startswith("00249"):
        digits_only = digits_only[2:]
    if digits_only.startswith("249") and len(digits_only) == 12 and digits_only[3] in ("9", "1"):
        return digits_only
    if digits_only.startswith("0") and len(digits_only) == 10 and digits_only[1] in ("9", "1"):
        return f"249{digits_only[1:]}"
    return None


def detect_city(text: str) -> str:
    """Detect canonical Sudanese city name from listing text or metadata."""
    normalized = to_ascii_digits(text or "").lower()
    for canonical, aliases in CITY_ALIASES:
        for alias in aliases:
            if alias.lower() in normalized:
                return canonical
    return "الخرطوم"


def detect_category(text: str, default_category: str = "سيارات صالون") -> str:
    """Classify listing into one of the 4 canonical platform categories."""
    lowered = to_ascii_digits(text or "").lower()
    parts_keywords = (
        "قطع غيار", "اسبير", "إسبير", "اطار", "إطار", "كفر", "جنوط", "ماكينة",
        "جيربوكس", "بطارية", "فانوس", "رديتر", "طلمبة", "spare", "parts", "tire",
    )
    agri_keywords = (
        "جرار", "تراكتور", "حاصدة", "حصادة", "آلية زراعية", "اليه زراعيه",
        "ماسي فيرغسون", "ماسي", "كلاس", "جون دير", "شاحنة", "دفار", "قلاية",
        "tractor", "harvester", "combine", "massey", "truck",
    )
    pickup_4x4_keywords = (
        "هايلوكس", "هايلكس", "لاندكروزر", "لاند كروزر", "شاص", "بوكس", "بكاسي",
        "دفع رباعي", "برادو", "فورتشنر", "تندرا", "تاكوما", "l200", "ميتسوبيشي",
        "باترول", "نافارا", "hilux", "land cruiser", "prado", "4x4", "pickup",
    )
    if any(k in lowered for k in parts_keywords):
        return "قطع غيار وإطارات"
    if any(k in lowered for k in agri_keywords):
        return "جرارات وآليات زراعية"
    if any(k in lowered for k in pickup_4x4_keywords):
        return "بكاسي ودفع رباعي"
    return default_category


def detect_model_tag(text: str, category: str) -> Optional[str]:
    """Map title/description to one of the Fair Price Calculator model tags."""
    lowered = to_ascii_digits(text or "").lower()
    if any(k in lowered for k in ("هايلوكس", "هايلكس", "hilux")):
        return "Toyota Hilux"
    if any(k in lowered for k in ("لاندكروزر", "لاند كروزر", "land cruiser", "landcruiser")):
        return "Toyota Land Cruiser"
    if any(k in lowered for k in ("توسان", "tucson")):
        return "Hyundai Tucson"
    if any(k in lowered for k in ("أكسنت", "اكسنت", "accent")):
        return "Hyundai Accent"
    if any(k in lowered for k in ("l200", "ال 200", "إل 200")):
        return "Mitsubishi L200"
    if any(k in lowered for k in ("ماسي", "فيرغسون", "massey", "ferguson", "جرار", "tractor")):
        return "Massey Ferguson Tractor"
    if any(k in lowered for k in ("حاصدة", "حصادة", "harvester", "combine")):
        return "Combine Harvester"
    if category == "قطع غيار وإطارات":
        return "Spare Parts"
    return None


def detect_year_tag(text: str) -> Optional[str]:
    """Extract a model year (2000-2026) and map it to calculator year ranges."""
    normalized = to_ascii_digits(text or "")
    years = [int(y) for y in re.findall(r"\b(20[0-2]\d)\b", normalized)]
    valid_years = [y for y in years if 2000 <= y <= 2026]
    if not valid_years:
        return None
    year = max(valid_years)
    if year <= 2012:
        return "2005–2012"
    if year <= 2018:
        return "2013–2018"
    return "2019–2026"


def detect_legal_status(text: str) -> str:
    """Detect Sudanese vehicle legal status from listing text."""
    lowered = (text or "").lower()
    if any(k in lowered for k in ("بدون ورق", "بدون أوراق", "غير مرخص", "بلا ورق")):
        return "بدون ورق"
    if any(k in lowered for k in ("أورنيك", "اورنيك", "جمارك", "شهادة جمركية")):
        return "أورنيك جمارك"
    return "ترخيص ساري"


def _looks_like_phone_number(num: float) -> bool:
    s = str(int(round(num)))
    if len(s) == 9 and s[0] in ("9", "1"):
        return True
    if len(s) == 10 and s.startswith(("09", "01")):
        return True
    if len(s) == 12 and s.startswith(("2499", "2491")):
        return True
    return False


def parse_price(
    raw_value: Any,
    currency_hint: Optional[str] = None,
    category: str = "سيارات صالون",
    parallel_rate: float = DEFAULT_PARALLEL_RATE,
    context_text: str = "",
) -> tuple[Optional[float], Optional[float]]:
    """
    Parse price and return (price_sdg, price_usd) with strict Sudan market validation.
    """
    if raw_value is None:
        return None, None

    text = to_ascii_digits(str(raw_value)).strip()
    if not text:
        return None, None

    combined_hint = f"{currency_hint or ''} {text} {context_text}".lower()
    is_usd = any(tok in combined_hint for tok in ("usd", "$", "دولار")) and "sdg" not in (currency_hint or "").lower()
    is_million = "مليون" in text or "million" in text.lower()
    is_thousand = ("ألف" in text or "الف" in text) and not is_million

    cleaned = text.replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)", cleaned)
    if not match:
        return None, None

    num = float(match.group(1))
    if num <= 0 or _looks_like_phone_number(num):
        return None, None

    if is_million:
        num *= 1_000_000
    elif is_thousand and num < 10_000:
        num *= 1_000

    min_sdg = MIN_PARTS_PRICE_SDG if category == "قطع غيار وإطارات" else MIN_VEHICLE_PRICE_SDG

    if is_usd:
        if num < MIN_USD_PRICE:
            return None, None
        price_usd = round(num, 2)
        price_sdg = round(price_usd * parallel_rate, 2)
        if price_sdg > MAX_SANE_PRICE_SDG:
            return None, None
        return price_sdg, price_usd

    if num < min_sdg or num > MAX_SANE_PRICE_SDG:
        return None, None

    price_sdg = round(num, 2)
    price_usd = round(price_sdg / parallel_rate, 2) if parallel_rate > 0 else None
    return price_sdg, price_usd


def _flatten_json_ld(data: Any) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    if isinstance(data, dict):
        items.append(data)
        if isinstance(data.get("@graph"), list):
            for node in data["@graph"]:
                items.extend(_flatten_json_ld(node))
        if isinstance(data.get("itemListElement"), list):
            for elem in data["itemListElement"]:
                items.extend(_flatten_json_ld(elem))
        if isinstance(data.get("item"), dict):
            items.extend(_flatten_json_ld(data["item"]))
    elif isinstance(data, list):
        for elem in data:
            items.extend(_flatten_json_ld(elem))
    return items


def extract_listing_from_html(
    html: str,
    url: str,
    default_category: str,
    parallel_rate: float,
) -> Optional[dict[str, Any]]:
    """Extract structured listing fields from an OpenSooq detail HTML page."""
    soup = BeautifulSoup(html, "html.parser")

    title = None
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    if not title and soup.title and soup.title.string:
        title = soup.title.string.strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(" ", strip=True)
    if not title:
        return None

    title = re.sub(r"\s*[-|]\s*(السوق المفتوح|OpenSooq).*$", "", title).strip()

    # تطبيق فلتر التنقية الصارم
    if not is_valid_auto_listing(title, url):
        logger.debug("Filtered out non-auto listing: %s", title)
        return None

    image_url = None
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        image_url = clean_image_url(og_image["content"])

    description = ""
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        description = og_desc["content"].strip()

    raw_price: Any = None
    currency_hint: Optional[str] = None
    ld_phone: Optional[str] = None
    ld_city: Optional[str] = None

    for script in soup.find_all("script", type="application/ld+json"):
        raw_json = script.string or script.get_text()
        if not raw_json:
            continue
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            continue
        for node in _flatten_json_ld(parsed):
            offers = node.get("offers")
            if isinstance(offers, list) and offers:
                offers = offers[0]
            if isinstance(offers, dict):
                if offers.get("price") is not None and raw_price is None:
                    raw_price = offers.get("price")
                    currency_hint = offers.get("priceCurrency")
                seller = offers.get("seller")
                if isinstance(seller, dict) and seller.get("telephone") and not ld_phone:
                    ld_phone = str(seller.get("telephone"))
            if node.get("price") is not None and raw_price is None:
                raw_price = node.get("price")
                currency_hint = node.get("priceCurrency")
            if node.get("image") and not image_url:
                img = node["image"]
                candidate_img = img[0] if isinstance(img, list) and img else str(img)
                image_url = clean_image_url(candidate_img)
            addr = node.get("address") or node.get("areaServed")
            if isinstance(addr, dict) and not ld_city:
                ld_city = str(addr.get("addressLocality") or addr.get("name") or "")

    if raw_price is None:
        meta_price = soup.find("meta", property="product:price:amount") or soup.find("meta", attrs={"name": "price"})
        if meta_price and meta_price.get("content"):
            raw_price = meta_price["content"]
        meta_curr = soup.find("meta", property="product:price:currency")
        if meta_curr and meta_curr.get("content"):
            currency_hint = meta_curr["content"]

    full_text = f"{title} {description} {soup.get_text(' ', strip=True)[:2500]}"
    category = detect_category(f"{title} {description}", default_category=default_category)

    price_sdg, price_usd = parse_price(
        raw_price,
        currency_hint=currency_hint,
        category=category,
        parallel_rate=parallel_rate,
        context_text=f"{title} {description}",
    )

    seller_phone = normalize_sudan_phone(ld_phone) or normalize_sudan_phone(full_text)
    city = detect_city(f"{ld_city or ''} {title} {description}")
    model_tag = detect_model_tag(f"{title} {description}", category=category)
    year_tag = detect_year_tag(f"{title} {description}")
    legal_status = detect_legal_status(f"{title} {description}")

    ad_id_match = re.search(r"/(\d{6,12})(?:/|$|\?)", url)
    external_id = (
        f"opensooq-{ad_id_match.group(1)}"
        if ad_id_match
        else f"opensooq-{hashlib.sha1(url.encode('utf-8')).hexdigest()[:16]}"
    )

    return {
        "external_id": external_id,
        "source_platform": "OpenSooq",
        "category": category,
        "title": title[:220],
        "model_tag": model_tag,
        "year_tag": year_tag,
        "legal_status": legal_status,
        "price_sdg": price_sdg,
        "price_usd": price_usd,
        "city": city,
        "image_url": image_url,
        "seller_phone": seller_phone,
        "source_url": url,
        "is_active": True,
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }


def extract_search_cards_fallback(
    html: str,
    default_category: str,
    parallel_rate: float,
) -> list[dict[str, Any]]:
    """Extract listing links (and inline JSON-LD ItemList items if present) from search HTML."""
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for script in soup.find_all("script", type="application/ld+json"):
        raw_json = script.string or script.get_text()
        if not raw_json:
            continue
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            continue
        for node in _flatten_json_ld(parsed):
            url = node.get("url")
            name = node.get("name")
            if not url or not name or "/ar/" not in str(url):
                continue
            abs_url = urljoin(BASE_URL, str(url).split("?")[0])
            if abs_url in seen_urls:
                continue
            seen_urls.add(abs_url)

            clean_title = str(name).strip()
            if not is_valid_auto_listing(clean_title, abs_url):
                continue

            offers = node.get("offers") if isinstance(node.get("offers"), dict) else {}
            category = detect_category(clean_title, default_category=default_category)
            price_sdg, price_usd = parse_price(
                offers.get("price") or node.get("price"),
                currency_hint=offers.get("priceCurrency") or node.get("priceCurrency"),
                category=category,
                parallel_rate=parallel_rate,
                context_text=clean_title,
            )
            img = node.get("image")
            raw_img = img[0] if isinstance(img, list) and img else (str(img) if img else None)
            image_url = clean_image_url(raw_img)

            ad_id_match = re.search(r"/(\d{6,12})(?:/|$|\?)", abs_url)
            ext_id = (
                f"opensooq-{ad_id_match.group(1)}"
                if ad_id_match
                else f"opensooq-{hashlib.sha1(abs_url.encode('utf-8')).hexdigest()[:16]}"
            )
            results.append(
                {
                    "external_id": ext_id,
                    "source_platform": "OpenSooq",
                    "category": category,
                    "title": clean_title[:220],
                    "model_tag": detect_model_tag(clean_title, category),
                    "year_tag": detect_year_tag(clean_title),
                    "legal_status": detect_legal_status(clean_title),
                    "price_sdg": price_sdg,
                    "price_usd": price_usd,
                    "city": detect_city(clean_title),
                    "image_url": image_url,
                    "seller_phone": normalize_sudan_phone(clean_title),
                    "source_url": abs_url,
                    "is_active": True,
                    "last_seen_at": datetime.now(timezone.utc).isoformat(),
                }
            )
    return results


def discover_detail_urls(html: str, limit: int = 12) -> list[str]:
    """Find candidate OpenSooq individual listing detail URLs (excluding /ar/search/ pages)."""
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/ar/search/" in href or "?term=" in href:
            continue
        if re.search(r"/\d{7,12}(?:/|$)", href):
            abs_url = urljoin(BASE_URL, href.split("?")[0])
            if abs_url not in seen and "opensooq.com" in abs_url:
                seen.add(abs_url)
                urls.append(abs_url)
                if len(urls) >= limit:
                    break
    return urls


def get_supabase_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


def fetch_parallel_rate(supabase_url: str, service_key: str) -> float:
    """Fetch latest parallel_rate from Supabase exchange_rates table."""
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/exchange_rates?select=parallel_rate&order=updated_at.desc&limit=1"
    try:
        resp = requests.get(endpoint, headers=get_supabase_headers(service_key), timeout=15)
        resp.raise_for_status()
        rows = resp.json()
        if rows and rows[0].get("parallel_rate"):
            rate = float(rows[0]["parallel_rate"])
            if rate > 0:
                logger.info("Loaded live parallel FX rate: %.2f SDG/USD", rate)
                return rate
    except Exception as exc:
        logger.warning("Could not fetch exchange_rates from Supabase (%s); using default %.2f", exc, DEFAULT_PARALLEL_RATE)
    return DEFAULT_PARALLEL_RATE


def cleanup_polluted_listings(supabase_url: str, service_key: str) -> None:
    """Delete previously scraped non-auto listings (e.g., real estate) from car_listings."""
    base = supabase_url.rstrip("/")
    headers = {
        **get_supabase_headers(service_key),
        "Prefer": "return=minimal",
    }
    try:
        resp = requests.get(
            f"{base}/rest/v1/car_listings?select=id,title,source_url,image_url&source_platform=eq.OpenSooq",
            headers=get_supabase_headers(service_key),
            timeout=20,
        )
        resp.raise_for_status()
        rows = resp.json()
        bad_ids = [
            row["id"]
            for row in rows
            if not is_valid_auto_listing(row.get("title") or "", row.get("source_url") or "")
        ]
        if bad_ids:
            id_list = ",".join(str(i) for i in bad_ids)
            del_resp = requests.delete(
                f"{base}/rest/v1/car_listings?id=in.({id_list})",
                headers=headers,
                timeout=20,
            )
            del_resp.raise_for_status()
            logger.info("Deleted %d polluted non-auto rows from car_listings", len(bad_ids))

        # إزالة روابط الشعارات من أي صف متبقٍ
        logo_ids = [
            row["id"]
            for row in rows
            if row.get("id") not in bad_ids
            and row.get("image_url")
            and clean_image_url(row.get("image_url")) is None
        ]
        if logo_ids:
            logo_list = ",".join(str(i) for i in logo_ids)
            patch_resp = requests.patch(
                f"{base}/rest/v1/car_listings?id=in.({logo_list})",
                headers=headers,
                json={"image_url": None},
                timeout=20,
            )
            patch_resp.raise_for_status()
            logger.info("Cleared generic logo images on %d listings", len(logo_ids))
    except Exception as exc:
        logger.warning("Cleanup step encountered a non-fatal error: %s", exc)


def upsert_listings(supabase_url: str, service_key: str, records: list[dict[str, Any]]) -> int:
    """Filter and upsert scraped records into Supabase car_listings on external_id."""
    clean_records = [
        r for r in records if is_valid_auto_listing(r.get("title") or "", r.get("source_url") or "")
    ]
    if not clean_records:
        return 0
    deduped = list({r["external_id"]: r for r in clean_records}.values())
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/car_listings?on_conflict=external_id"
    headers = {
        **get_supabase_headers(service_key),
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    resp = requests.post(endpoint, headers=headers, json=deduped, timeout=30)
    resp.raise_for_status()
    return len(deduped)


def deactivate_stale_opensooq_listings(supabase_url: str, service_key: str) -> None:
    """
    Set is_active = false for OpenSooq listings not seen in the last 36 hours.
    Never deactivates DirectUser or is_featured listings.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=STALE_HOURS)).isoformat()
    endpoint = (
        f"{supabase_url.rstrip('/')}/rest/v1/car_listings"
        f"?source_platform=eq.OpenSooq"
        f"&is_featured=eq.false"
        f"&is_active=eq.true"
        f"&last_seen_at=lt.{quote_plus(cutoff)}"
    )
    headers = {
        **get_supabase_headers(service_key),
        "Prefer": "return=minimal",
    }
    resp = requests.patch(endpoint, headers=headers, json={"is_active": False}, timeout=20)
    resp.raise_for_status()
    logger.info("Deactivated stale OpenSooq listings older than %s", cutoff)


def scrape_opensooq(parallel_rate: float) -> list[dict[str, Any]]:
    """Scrape all 5 targeted OpenSooq Sudan automotive & machinery categories."""
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    )

    all_records: list[dict[str, Any]] = []
    for query_label, search_url, default_cat in TARGET_QUERIES:
        logger.info("Querying OpenSooq category [%s]: %s", query_label, search_url)
        try:
            res = session.get(search_url, timeout=20)
            if res.status_code != 200:
                logger.warning("OpenSooq returned HTTP %s for '%s'", res.status_code, query_label)
                continue
        except requests.RequestException as exc:
            logger.warning("Request failed for '%s': %s", query_label, exc)
            continue

        inline_items = extract_search_cards_fallback(res.text, default_cat, parallel_rate)
        all_records.extend(inline_items)

        detail_urls = discover_detail_urls(res.text, limit=10)
        logger.info("Found %d valid inline items and %d detail URLs for '%s'", len(inline_items), len(detail_urls), query_label)

        for detail_url in detail_urls:
            try:
                time.sleep(0.8)
                d_res = session.get(detail_url, timeout=15)
                if d_res.status_code != 200:
                    continue
                record = extract_listing_from_html(d_res.text, detail_url, default_cat, parallel_rate)
                if record:
                    all_records.append(record)
            except requests.RequestException as exc:
                logger.debug("Skipping detail URL %s: %s", detail_url, exc)

    return all_records


def main() -> int:
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        logger.error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return 1

    # 1. تنظيف السجلات الملوثة وصور الشعارات الموجودة حالياً
    cleanup_polluted_listings(supabase_url, service_key)

    # 2. جلب سعر الصرف وسحب العروض الجديدة النظيفة
    parallel_rate = fetch_parallel_rate(supabase_url, service_key)
    records = scrape_opensooq(parallel_rate)
    logger.info("Total valid scraped candidate records: %d", len(records))

    if records:
        count = upsert_listings(supabase_url, service_key, records)
        logger.info("Upserted %d clean listings into car_listings", count)
    else:
        logger.warning("No new records scraped in this run")

    deactivate_stale_opensooq_listings(supabase_url, service_key)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
