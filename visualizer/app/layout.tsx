import type { Metadata } from "next";
import type { WebApplication, WithContext } from "schema-dts";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProviderClient } from "@/components/wallet-provider-client";
import { JsonLd } from "@/components/json-ld";
import "./globals.css";

const jsonLd: WithContext<WebApplication> = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Bitbench",
  url: "https://bitbench.org",
  description:
    "A donation-funded benchmark platform for comparing 40+ AI models on blockchain development tasks, libraries, and protocols.",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  provider: {
    "@type": "Organization",
    name: "Bitbench",
    url: "https://bitbench.org",
    logo: {
      "@type": "ImageObject",
      url: "https://bitbench.org/favicon.svg",
    },
    sameAs: ["https://github.com/b-open-io/bitbench"],
  },
  featureList: [
    "AI model benchmarking for blockchain tasks",
    "BSV donation-funded test runs",
    "40+ model comparison",
    "Open source results",
  ],
};

export const metadata: Metadata = {
  title: "Bitbench - Blockchain AI Benchmark Platform",
  description:
    "A donation-funded benchmark platform for comparing 40+ AI models on blockchain development tasks, libraries, and protocols.",
  metadataBase: new URL("https://bitbench.org"),
  openGraph: {
    title: "Bitbench - Blockchain AI Benchmark Platform",
    description:
      "Compare 40+ AI models on blockchain development tasks. Donation-funded, open source benchmarking.",
    url: "https://bitbench.org",
    siteName: "Bitbench",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Bitbench - Blockchain AI Benchmark Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bitbench - Blockchain AI Benchmark Platform",
    description:
      "Compare 40+ AI models on blockchain development tasks. Donation-funded, open source benchmarking.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
        <JsonLd data={jsonLd} />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <WalletProviderClient>{children}</WalletProviderClient>
        </ThemeProvider>
      </body>
    </html>
  );
}
