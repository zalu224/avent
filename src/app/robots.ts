import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/e/", "/signup", "/login"] },
      {
        userAgent: "*",
        disallow: ["/feed", "/calendar", "/discover", "/activity", "/people", "/settings", "/events/", "/api/", "/u/"],
      },
    ],
  };
}
