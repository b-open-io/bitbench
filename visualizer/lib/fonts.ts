/**
 * Font loading utilities for Theme Token integration
 */

import {
  isOnChainPath,
  extractOrigin,
  loadFontByOrigin,
} from "@theme-token/sdk";

// System font stacks for fallbacks
const SYSTEM_FONTS = {
  sans: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  serif: "ui-serif, Georgia, Cambria, Times New Roman, serif",
  mono: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace",
};

// Known Google Fonts we support
const GOOGLE_FONTS = new Set([
  "Inter", "DM Sans", "Geist", "IBM Plex Sans", "Montserrat", "Open Sans",
  "Outfit", "Plus Jakarta Sans", "Poppins", "Roboto", "Space Grotesk",
  "Nunito", "Lato", "Raleway", "Work Sans", "Manrope", "Sora",
  "Libre Baskerville", "Lora", "Merriweather", "Playfair Display",
  "Source Serif 4", "Crimson Pro", "EB Garamond", "Cormorant", "Spectral",
  "Fira Code", "Geist Mono", "IBM Plex Mono", "JetBrains Mono",
  "Roboto Mono", "Source Code Pro", "Space Mono",
]);

// Cache for loaded fonts
const loadedFonts = new Set<string>();

/**
 * Extract font family name from CSS font-family value
 */
function extractFontFamily(fontValue: string): string | null {
  if (!fontValue) return null;

  const match = fontValue.match(/^["']?([^"',]+)["']?/);
  if (!match) return null;

  const fontName = match[1].trim();

  // Skip system fonts
  const systemFonts = [
    "ui-sans-serif", "ui-serif", "ui-monospace", "system-ui",
    "-apple-system", "BlinkMacSystemFont", "sans-serif", "serif", "monospace",
  ];
  if (systemFonts.includes(fontName.toLowerCase())) return null;

  return fontName;
}

/**
 * Load a Google Font dynamically
 */
function loadGoogleFont(fontName: string): void {
  if (typeof window === "undefined") return;
  if (loadedFonts.has(fontName)) return;

  const encodedFamily = encodeURIComponent(fontName);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);

  loadedFonts.add(fontName);
}

/**
 * Load all fonts from a theme (Google Fonts and on-chain fonts)
 */
export async function loadThemeFonts(theme: {
  styles: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}): Promise<void> {
  const fontKeys = ["font-sans", "font-serif", "font-mono"] as const;
  const onChainLoads: Promise<string>[] = [];

  for (const key of fontKeys) {
    const lightValue = theme.styles.light[key];
    const darkValue = theme.styles.dark[key];

    for (const value of [lightValue, darkValue]) {
      if (!value) continue;

      // Check if it's an on-chain font
      if (isOnChainPath(value)) {
        const origin = extractOrigin(value);
        if (origin) {
          onChainLoads.push(
            loadFontByOrigin(origin).then((familyName) => {
              const slot = key.replace("font-", "") as "sans" | "serif" | "mono";
              document.documentElement.style.setProperty(
                `--font-${slot}`,
                `"${familyName}", ${SYSTEM_FONTS[slot]}`
              );
              return familyName;
            })
          );
        }
      } else {
        // Google Font or system font
        const fontName = extractFontFamily(value);
        if (fontName && GOOGLE_FONTS.has(fontName)) {
          loadGoogleFont(fontName);
        }
      }
    }
  }

  // Wait for all on-chain fonts to load
  if (onChainLoads.length > 0) {
    await Promise.all(onChainLoads);
  }
}
