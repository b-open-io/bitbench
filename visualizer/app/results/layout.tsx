import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Benchmark Results - Bitbench",
  description:
    "Global leaderboard showing AI model performance across all Bitcoin and blockchain development benchmarks. Compare accuracy, cost, and speed.",
  openGraph: {
    title: "Benchmark Results - Bitbench",
    description:
      "Global leaderboard showing AI model performance across all Bitcoin and blockchain development benchmarks.",
    url: "https://bitbench.org/results",
  },
  twitter: {
    title: "Benchmark Results - Bitbench",
    description:
      "Global leaderboard showing AI model performance across all Bitcoin and blockchain development benchmarks.",
  },
}

export default function ResultsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
