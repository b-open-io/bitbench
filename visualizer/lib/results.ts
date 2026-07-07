import "server-only"

import { getRuns } from "./kv"
import type { ModelResult } from "./types"

export interface MergedCell extends ModelResult {
  runAt: string
  runId?: string
}

export async function getMergedCells(
  suiteId: string,
  suiteVersion: string,
): Promise<MergedCell[]> {
  const runs = await getRuns(suiteId, 50)
  const cells = new Map<string, MergedCell>()

  for (const run of runs) {
    if (run.version !== suiteVersion) continue

    for (const ranking of run.rankings) {
      const current = cells.get(ranking.model)
      if (!current || new Date(run.timestamp) > new Date(current.runAt)) {
        cells.set(ranking.model, {
          ...ranking,
          runAt: run.timestamp,
          runId: run.id,
        })
      }
    }
  }

  return [...cells.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.model.localeCompare(b.model)
  })
}
