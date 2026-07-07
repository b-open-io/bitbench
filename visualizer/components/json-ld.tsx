import type { Thing, WithContext } from "schema-dts"

/**
 * Renders JSON-LD structured data for SEO.
 * Sanitizes output to prevent XSS attacks per Next.js recommendation.
 * @see https://nextjs.org/docs/app/guides/json-ld
 */
export function JsonLd<T extends Thing>({ data }: { data: WithContext<T> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized with JSON.stringify and escapes < as \u003c per Next.js guidance.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
