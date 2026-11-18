import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/types";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
  ];
}
