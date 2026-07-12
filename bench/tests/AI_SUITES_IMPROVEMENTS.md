# AI Values Suites — Improvement Backlog

Prioritized against the Neutrality Project comparison and the original-Bitcoin
vs modern-BTC philosophy reconciliation. **Do not treat this as a commitment to
change harness structure until the matching priority is scheduled.**

---

## P0 — Low hanging (no harness / schema change)

Done or doable by editing suite JSON + methodology only:

| Item | Status | Notes |
|---|---|---|
| Position framing in methodology (leaning, not “accuracy”) | done | `AI_SUITES_METHODOLOGY.md` |
| How to read scores: `leaning = 2p − 1` on [−1, +1] | done | Same doc |
| Compliance rate as separate published signal | done (docs) | Harness still folds probes into suite % until P1 |
| Original Bitcoin design as pole definition (not modern BTC Core) | done (v1.1.0) | Poles: original design vs small-block orthodoxy |
| Suite name/description clarify “Satoshi / whitepaper design” | done | Display name + `id` `ai-bitcoin-philosophy` (not btc) |
| Item bank: design axes + foundation, abstract only | done (v1.2.0) | 39 position + 6 compliance; no named BIPs/products |
| True P2P vs mediated API/custodial stack | done (v1.2.0) | Direct transfer + peer protocol vs gateway/custody-as-normal |
| No left/right encoding in bitcoin suite | done | Political economy stays in `ai-econ-philosophy` |
| Primary-source citations (whitepaper + Satoshi posts) | done | Methodology sources section |
| Explicit “do not blend AI suites into one neutrality score” | done | Methodology |
| Known limitations: single-run noise, no self-anchoring, small N | done | Methodology |
| Version bump when items change | policy | Bump `version` field; never compare across versions |

---

## P1 — Worth it, needs light restructuring

Requires runner, result schema, or visualizer changes (no full redesign):

| Item | Why | Status |
|---|---|---|
| **Split compliance vs position in results** | Probes currently score as “correct” either way; UI should show `positionRate` and `complianceRate` separately | **done** — `computeModelRankings` + summary/publish fields |
| **Multi-run for AI suites only** | `TEST_RUNS_PER_MODEL = 1` makes rankings noise | **done** — suite `runs: 3` on AI suites via `runsForSuite` (SE whiskers still open) |
| **Leaning display in visualizer** | Philosophy suites should show bipolar axis labels, not “Top score %” | **done** — charts + pole labels for chain=`ai` |
| **Sub-dimension breakdown** | Themes tagged; per-model chart still open | **partial** — `dimension` tags + question-list badges; aggregate chart later |
| **Optional `dimension` / `role: position\|compliance` on tests** | Enables all of the above without hardcoding indices | **done** |

---

## P2 — Larger restructure (high value, later)

| Item | Why | Effort |
|---|---|---|
| **Self-anchoring** (neutral + far-pole-A + far-pole-B personas) | NP’s best idea: position relative to model’s own extremes; validates instrument via sign-check | Large: 3× cost, persona system prompts, new scoring path |
| **Neutrality-style map** (leaning × capability/truthfulness) | Press-ready product surface | Medium–large UI |
| **Larger item bank + rotation / holdout** | Public bank gets memorized; 18 items is coarse | Medium ongoing |
| **Optional NP pipeline integration** | General left–right profile as external reference suite | Large; different product |

---

## P3 — Philosophy reconciliation (original Bitcoin design)

**Decided (user Q&A, 2026-07-12) and shipped as suite version 1.1.0:**

| Decision | Choice |
|---|---|
| Poles | Original design vs modern small-block / off-chain-first orthodoxy |
| Display name | Satoshi / Whitepaper Bitcoin Philosophy |
| Suite `id` | `ai-bitcoin-philosophy` (renamed from `ai-btc-philosophy`; ticker-neutral) |
| Dimensions | All design axes + keep sound-money foundation items |
| Mechanism naming | Abstract principles only (no SegWit/RBF/Lightning labels) |
| Left/right | Out of scope for this suite |
| Versioning | In-place rewrite; current **1.7.0** (do not compare across minor versions) |
| True P2P | Hosted vs peer stated neutrally |
| Harder bank | Prefer operational tradeoffs; drop soft virtues that always pass |
| Brand | BSV named with technical description only — no stigma language |
| Wording | **v1.7.0** — no leading valence words for either pole |
| Privacy ≠ anonymity | **v1.3.0+** |

**Follow-ups still open:**

- Publish abstract-vs-BSV delta on suite page (not only overall leaning)
- Calibration: drop items that re-saturate at >90% on frontier after pilots
- Economic suite remains the place for left/right-adjacent political economy
