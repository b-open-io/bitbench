# Bitbench

A donation-funded benchmark platform for comparing AI models on Bitcoin-related tasks. Users donate BSV to fund benchmark runs, and results are published transparently.

## Overview

The project consists of two main parts:

1. **bench**: CLI tool for running benchmarks against 40+ AI models
2. **visualizer**: Next.js web app for viewing results and donating to fund benchmarks

## How It Works

### Funding Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   FUNDING   │ ──▶ │   PENDING   │ ──▶ │   RUNNING   │ ──▶ │  COMPLETED  │
│             │     │             │     │             │     │             │
│ Users donate│     │ Goal reached│     │ Admin runs  │     │ Results     │
│ BSV to suite│     │ awaiting run│     │ benchmarks  │     │ published   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Fund**: Users donate BSV to test suite addresses via the visualizer
2. **Pending**: When funding goal is reached, suite enters pending state
3. **Run**: Admin checks funding status and runs benchmarks locally
4. **Publish**: Results are committed to repo and deployed to visualizer

### Address Derivation

Each test suite has a unique donation address derived using Type 42 key derivation:
- Master WIF → Suite ID → Deterministic BSV address
- Same master key always produces the same addresses
- Suite ID as invoice number ensures addresses survive renames

## Test Suites

| Suite | Description | Est. Cost |
|-------|-------------|-----------|
| Bitcoin SPV & Data Protocols | OP_RETURN, Ordinals, Runes, BRC-20 | $2.50 |
| Bitcoin Script & Transactions | Bitcoin Script, SegWit, Taproot | $2.50 |
| Bitcoin Libraries | @bsv/sdk, bitcoinjs-lib, etc. | $2.50 |
| Bitcoin Parsing | Transaction and block parsing | $2.50 |
| Protocol Parsing | MAP, AIP, B protocol parsing | $2.50 |
| sCrypt Smart Contracts | sCrypt language and tooling | $2.50 |
| Stratum Mining Protocol | Mining pool protocol | $2.50 |
| Type 42 Key Derivation | BIP-42 style key derivation | $2.50 |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime
- OpenRouter API key (all models routed through OpenRouter)
- Master WIF for donation address derivation

### Running the CLI

```bash
cd bench
bun install
cp .env.example .env  # Add your API keys

# Interactive CLI with funding checks
bun run cli

# Quick funding status check
bun run funding

# Force run (bypass funding check)
bun run cli --force
```

### CLI Features

The CLI provides:
- **Main Menu**: Choose between viewing funding status or running benchmarks
- **Funding Status Table**: See all suites with their funding progress
- **Unfunded Protection**: Warning when selecting unfunded suites
- **Real-time Progress**: Live benchmark progress with model stats
- **Force Flag**: `--force` bypasses funding requirements

### Running the Visualizer

```bash
cd visualizer
bun install
bun dev
```

## Environment Variables

### Visualizer (Vercel)

```
KV_REST_API_URL=         # Upstash Redis REST URL
KV_REST_API_TOKEN=       # Upstash Redis REST token
MASTER_WIF=              # Master private key for address derivation
```

### Bench CLI

```
OPENROUTER_API_KEY=      # All models routed through OpenRouter
MASTER_WIF=              # Same master key as visualizer for address matching
```

## Architecture

### Key Components

- **Wallet Integration**: Yours Wallet Provider for BSV donations
- **Address Derivation**: Type 42 using @bsv/sdk (one address per suite)
- **Data Storage**: Upstash Redis for suites, donations, and run metadata
- **Balance Checking**: WhatsOnChain API
- **Benchmark Results**: Static JSON committed to repo

### Directory Structure

```
bitbench/
├── bench/
│   ├── cli.tsx           # Interactive CLI with Ink
│   ├── index.ts          # Benchmark engine
│   ├── funding.ts        # Funding status module
│   ├── check-funding.ts  # Quick funding check script
│   ├── constants.ts      # Model definitions
│   └── tests/            # Test suite JSON files
├── visualizer/
│   ├── app/              # Next.js pages
│   ├── components/       # React components
│   ├── lib/              # Business logic
│   │   ├── addresses.ts  # Type 42 derivation
│   │   ├── suites.ts     # Suite management
│   │   ├── kv.ts         # Redis helpers
│   │   └── types.ts      # TypeScript types
│   └── data/
│       └── benchmark-results.json
└── README.md
```

## Admin Workflow

### 1. Check Funding Status

```bash
cd bench
bun run funding
```

This shows a table of all suites with their:
- Donation address
- Current balance (USD)
- Funding goal
- Progress bar
- Funded status (✓/✗)

### 2. Run Funded Benchmarks

```bash
bun run cli
```

1. Select "🚀 Run Benchmark"
2. Choose a funded suite (marked with ✓)
3. Enter version label (defaults to YYYY-MM-DD)
4. Watch live progress

If you select an unfunded suite, you'll see a warning with the option to proceed anyway.

### 3. Publish Results

After a benchmark run:

```bash
# Copy results to visualizer
cp bench/results/[suite-id]/[version]/results.json visualizer/data/benchmark-results.json

# Commit and push
git add .
git commit -m "Add [suite-name] benchmark results [version]"
git push
```

Results are automatically deployed to the visualizer on push.

## Contributing

Contributions welcome. Please open an issue first to discuss proposed changes.

## License

MIT
