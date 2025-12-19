import type { MetadataRoute } from "next";
import { getAllSuites } from "@/lib/suites";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://bitbench.org";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/results`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Dynamic suite pages
  const suites = await getAllSuites();
  const suitePages: MetadataRoute.Sitemap = suites.map((suite) => ({
    url: `${baseUrl}/suite/${suite.id}`,
    lastModified: suite.lastRunAt ? new Date(suite.lastRunAt) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...suitePages];
}
