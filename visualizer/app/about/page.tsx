import { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SuiteListModal } from "@/components/suite-list-modal";
import { getAllSuites } from "@/lib/suites";
import { Github, GitPullRequest, Coins, Zap, FileJson } from "lucide-react";

export const metadata: Metadata = {
  title: "About - Bitbench",
  description:
    "Learn how Bitbench works: donation-funded AI benchmarks for Bitcoin development.",
};

export default async function AboutPage() {
  const suites = await getAllSuites();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader modelCount={44} />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          How Bitbench Works
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          A community-funded platform for benchmarking AI models on Bitcoin
          development tasks.
        </p>

        {/* How It Works */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Donation-Funded Benchmarks
          </h2>
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p>
              Each test suite has its own BSV donation address. When a suite
              reaches its funding goal (typically $25-35 to cover API costs for all models), the
              benchmark runs automatically against 40+ AI models.
            </p>
            <p>
              Results are published publicly, showing which models perform best
              on specific Bitcoin development tasks. This helps developers
              choose the right AI tools for their work.
            </p>
          </div>
        </section>

        {/* Contributing */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-primary" />
            Contributing Test Questions
          </h2>
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p>
              Test suites are defined as JSON files in the{" "}
              <code>bench/tests/</code> directory. Anyone can submit a pull
              request to add, modify, or improve test questions.
            </p>
            <p>Each test file contains:</p>
            <ul>
              <li>
                <strong>name</strong> &amp; <strong>description</strong> - Suite
                metadata
              </li>
              <li>
                <strong>version</strong> - Semantic version (e.g., "1.0.0")
              </li>
              <li>
                <strong>system_prompt</strong> - Context given to AI models
              </li>
              <li>
                <strong>tests</strong> - Array of questions with expected
                answers
              </li>
            </ul>
          </div>

          {/* Example JSON */}
          <div className="mt-4 rounded-lg bg-muted/50 p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-muted-foreground">
              {`{
  "name": "BSV Data Protocols",
  "description": "1Sat Ordinals, MAP, AIP...",
  "version": "1.0.0",
  "system_prompt": "You are a Bitcoin expert...",
  "tests": [
    {
      "prompt": "What prefix does MAP use?",
      "answers": ["1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5"],
      "negative_answers": ["OP_RETURN"]
    }
  ]
}`}
            </pre>
          </div>

          <div className="mt-4 flex gap-3">
            <a
              href="https://github.com/b-open-io/bitbench/tree/main/bench/tests"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <FileJson className="h-4 w-4" />
              View Test Files
            </a>
            <a
              href="https://github.com/b-open-io/bitbench/pulls"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <GitPullRequest className="h-4 w-4" />
              Open a PR
            </a>
          </div>
        </section>

        {/* Versioning */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Test Suite Versioning
          </h2>
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p>
              Each test suite is versioned using semantic versioning. When
              questions are added or modified, the version is bumped:
            </p>
            <ul>
              <li>
                <strong>Patch</strong> (1.0.x) - Typo fixes, answer improvements
              </li>
              <li>
                <strong>Minor</strong> (1.x.0) - New questions added
              </li>
              <li>
                <strong>Major</strong> (x.0.0) - Significant restructuring
              </li>
            </ul>
            <p>
              Benchmark results are tagged with the version used, so you can
              track how model performance changes as tests evolve.
            </p>
          </div>
        </section>

        {/* Current Suites */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">
            Current Test Suites ({suites.length})
          </h2>
          <SuiteListModal suites={suites} />
        </section>

        {/* Get Involved */}
        <section className="rounded-lg border border-border bg-muted/30 p-6">
          <h2 className="text-xl font-semibold mb-2">Get Involved</h2>
          <p className="text-muted-foreground mb-4">
            Bitbench is open source. Star the repo, contribute tests, or fund a
            benchmark run.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/b-open-io/bitbench"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Coins className="h-4 w-4" />
              Fund a Benchmark
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
