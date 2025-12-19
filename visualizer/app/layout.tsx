import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProviderClient } from "@/components/wallet-provider-client";
import "./globals.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://bitbench.org/#organization",
      name: "Bitbench",
      url: "https://bitbench.org",
      logo: {
        "@type": "ImageObject",
        url: "https://bitbench.org/favicon.svg",
      },
      sameAs: ["https://github.com/b-open-io/bitbench"],
    },
    {
      "@type": "WebSite",
      "@id": "https://bitbench.org/#website",
      url: "https://bitbench.org",
      name: "Bitbench",
      description:
        "A donation-funded benchmark platform for comparing AI models on blockchain development tasks.",
      publisher: { "@id": "https://bitbench.org/#organization" },
    },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
