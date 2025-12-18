"use client";

import {
  applyTheme as applyThemeStyles,
  clearTheme as clearThemeStyles,
  type ThemeStyleProps,
  type ThemeToken,
} from "@theme-token/sdk";
import { loadThemeFonts } from "@/lib/fonts";
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

interface ThemeTokenContextValue {
  /** Currently active theme token */
  activeTheme: ThemeToken | null;
  /** Current mode (light/dark) */
  mode: "light" | "dark";
  /** List of available theme tokens from wallet */
  availableThemes: ThemeToken[];
  /** Set available themes (called by wallet provider) */
  setAvailableThemes: (themes: ThemeToken[]) => void;
  /** Apply a theme token */
  applyTheme: (theme: ThemeToken | null) => void;
  /** Apply a theme token with animation from click position */
  applyThemeAnimated: (theme: ThemeToken | null, e?: MouseEvent) => void;
  /** Reset to default site theme */
  resetTheme: () => void;
}

const ThemeTokenContext = createContext<ThemeTokenContextValue | null>(null);

const STORAGE_KEY = "bitbench-theme-selection";

// Calculate max radius for circular reveal animation
function getMaxRadius(x: number, y: number): number {
  const right = window.innerWidth - x;
  const bottom = window.innerHeight - y;
  return Math.hypot(Math.max(x, right), Math.max(y, bottom));
}

function applyThemeToDocument(styles: ThemeStyleProps | null): void {
  if (!styles) {
    clearThemeStyles();
    return;
  }
  applyThemeStyles(styles);
}

function ThemeTokenProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useNextTheme();
  const mode = (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark";

  const [activeTheme, setActiveTheme] = useState<ThemeToken | null>(null);
  const [availableThemes, setAvailableThemes] = useState<ThemeToken[]>([]);

  // Apply theme when activeTheme or mode changes
  useEffect(() => {
    if (activeTheme) {
      loadThemeFonts(activeTheme);
      applyThemeToDocument(activeTheme.styles[mode]);
    }
  }, [activeTheme, mode]);

  const applyTheme = useCallback(
    (theme: ThemeToken | null) => {
      setActiveTheme(theme);

      if (theme) {
        loadThemeFonts(theme);
        applyThemeToDocument(theme.styles[mode]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeName: theme.name }));
      } else {
        applyThemeToDocument(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    [mode]
  );

  const resetTheme = useCallback(() => {
    setActiveTheme(null);
    applyThemeToDocument(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const applyThemeAnimated = useCallback(
    async (theme: ThemeToken | null, e?: MouseEvent): Promise<void> => {
      // Use View Transitions API if available
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        const x = e?.clientX ?? window.innerWidth / 2;
        const y = e?.clientY ?? window.innerHeight / 2;
        const maxRadius = getMaxRadius(x, y);

        const transition = (
          document as Document & {
            startViewTransition: (cb: () => void) => {
              ready: Promise<void>;
              finished: Promise<void>;
            };
          }
        ).startViewTransition(() => {
          applyTheme(theme);
        });

        await transition.ready;

        // Animate with circle reveal
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 500,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );

        await transition.finished;
      } else {
        applyTheme(theme);
      }
    },
    [applyTheme]
  );

  // Restore saved theme when availableThemes changes (wallet connects)
  useEffect(() => {
    if (availableThemes.length === 0) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const { themeName } = JSON.parse(saved) as { themeName?: string };
      if (themeName) {
        const found = availableThemes.find((t) => t.name === themeName);
        if (found) {
          setActiveTheme(found);
          applyThemeToDocument(found.styles[mode]);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [availableThemes, mode]);

  return (
    <ThemeTokenContext.Provider
      value={{
        activeTheme,
        mode,
        availableThemes,
        setAvailableThemes,
        applyTheme,
        applyThemeAnimated,
        resetTheme,
      }}
    >
      {children}
    </ThemeTokenContext.Provider>
  );
}

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = true,
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
    >
      <ThemeTokenProvider>{children}</ThemeTokenProvider>
    </NextThemesProvider>
  );
}

export function useThemeToken() {
  const context = useContext(ThemeTokenContext);
  if (!context) {
    throw new Error("useThemeToken must be used within a ThemeProvider");
  }
  return context;
}

// Re-export useTheme from next-themes for dark/light toggle
export { useTheme } from "next-themes";
