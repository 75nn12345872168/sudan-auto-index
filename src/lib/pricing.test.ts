import { describe, expect, it } from "vitest";
import {
  calculateFairPrice,
  evaluateOfferPrice,
  formatSdgPrice,
  isValidSdgPrice,
  normalizeSudanPhone,
  NO_PRICE_LABEL,
} from "./pricing";
import { FALLBACK_LISTINGS } from "./fallback-data";

describe("pricing & validation utilities", () => {
  it("enforces strict SDG pricing thresholds", () => {
    expect(isValidSdgPrice(499999, "سيارات صالون")).toBe(false);
    expect(isValidSdgPrice(500000, "سيارات صالون")).toBe(true);
    expect(isValidSdgPrice(9999, "قطع غيار وإطارات")).toBe(false);
    expect(isValidSdgPrice(10000, "قطع غيار وإطارات")).toBe(true);
    expect(formatSdgPrice(1500, "سيارات صالون")).toBe(NO_PRICE_LABEL);
    expect(formatSdgPrice(45000000, "سيارات صالون")).toBe("45,000,000 ج.س");
  });

  it("normalizes Sudanese mobile numbers to 249 format", () => {
    expect(normalizeSudanPhone("0912345678")).toBe("249912345678");
    expect(normalizeSudanPhone("0125939730")).toBe("249125939730");
    expect(normalizeSudanPhone("+249912345678")).toBe("249912345678");
    expect(normalizeSudanPhone("٠٩١٢٣٤٥٦٧٨")).toBe("249912345678");
    expect(normalizeSudanPhone("0512345678")).toBeNull();
  });

  it("computes median fair price from live listings in memory", () => {
    const result = calculateFairPrice({
      listings: FALLBACK_LISTINGS,
      modelKey: "Toyota Hilux",
      yearRange: "2019–2026",
      legalStatus: "ترخيص ساري",
      parallelRate: 2650,
    });
    expect(result.medianSdg).toBe(91500000);
    expect(result.sampleCount).toBe(1);
    expect(result.matchScope).toBe("exact");
  });

  it("evaluates offered price against median correctly", () => {
    expect(evaluateOfferPrice(40000000, 50000000)?.label).toBe(
      "صفقة ممتازة (أقل من السوق)"
    );
    expect(evaluateOfferPrice(51000000, 50000000)?.label).toBe("سعر عادل");
    expect(evaluateOfferPrice(62000000, 50000000)?.label).toBe(
      "مبالغ فيه (أعلى من السوق)"
    );
  });
});
