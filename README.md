# Bitbench

A donation-funded benchmark platform for comparing AI models on Bitcoin-related tasks. Users donate BSV to fund benchmark runs, and results are published transparently.

## Overview

The project consists of two main parts:

1. **bench**: CLI tool for running benchmarks against 40+ AI models
2. **visualizer**: Next.js web app for viewing results and donating to fund benchmarks

## How It Works

1. **Fund**: Users donate BSV to test suite addresses to fund benchmark runs
2. **Pending**: When funding goal is reached, suite enters pending state
3. **Run**: Admin runs benchmarks locally using the CLI
4. **Publish**: Results are uploaded and displayed on the visualizer

## Test Suites

- Bitcoin SPV & Data Protocols
- Bitcoin Script & Transactions
- Bitcoin Libraries
- Bitcoin Parsing
- Protocol Parsing
- sCrypt Smart Contracts
- Stratum Mining Protocol
- Type 42 Key Derivation

## Getting Started

### Prerequisites

- [Bun](https://bun.sh)
- OpenRouter API key (all models routed through OpenRouter)

### Running Benchmarks (Admin)

```bash
cd bench
bun install
cp .env.example .env  # Add your API keys
bun run cli
```

### Running the Visualizer

```bash
cd visualizer
bun install
bun dev
```

## Environment Variables

### Visualizer

```
REDIS_URL=           # Upstash Redis REST URL
REDIS_TOKEN=         # Upstash Redis REST token
MASTER_WIF=          # Master private key for donation address derivation
```

### Bench CLI

```
OPENROUTER_API_KEY=      # All models routed through OpenRouter
```

## Architecture

- **Wallet Integration**: Yours Wallet Provider for BSV donations
- **Address Derivation**: Type 42 using @bsv/sdk (one address per suite)
- **Data Storage**: Upstash Redis for suites, donations, and benchmark runs
- **Balance Checking**: WhatsOnChain API

## Contributing

Contributions welcome. Please open an issue first to discuss proposed changes.

## License

MIT
