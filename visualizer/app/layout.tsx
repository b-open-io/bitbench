import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { WalletProvider } from "@/components/wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bitbench - Bitcoin AI Benchmark Platform",
  description:
    "A donation-funded benchmark platform for comparing 40+ AI models on Bitcoin-related tasks, libraries, and protocols.",
  metadataBase: new URL("https://bitbench.org"),
  openGraph: {
    title: "Bitbench - Bitcoin AI Benchmark Platform",
    description:
      "Compare AI model performance on Bitcoin development tasks. Donation-funded, open source benchmarking.",
    url: "https://bitbench.org",
    siteName: "Bitbench",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Bitbench - AI Benchmark Platform for Bitcoin/BSV",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bitbench - Bitcoin AI Benchmark Platform",
    description:
      "Compare AI model performance on Bitcoin development tasks. Donation-funded, open source benchmarking.",
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
    <html lang="en" className="dark">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
