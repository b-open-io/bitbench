import "server-only"

import { createHash } from "node:crypto"
import { getRunRequestAddress } from "./addresses"
import {
  getRunRequestIds,
  getStoredRunRequest,
  isRedisConfigured,
  putRunRequest,
  updateRunRequestStatus,
} from "./kv"
import { getRunRequestModelCatalog, getSuite, getSuiteFile } from "./suites"
import type { RunRequest, RunRequestStatus } from "./types"

const MAX_OPEN_REQUESTS_PER_SUITE = 50

export function getRunRequestId(
  suiteId: string,
  suiteVersion: string,
  modelIds: string[],
): string {
  const sorted = [...modelIds].sort()
  return createHash("sha256")
    .update(`${suiteId}@${suiteVersion}:${sorted.join(",")}`)
    .digest("hex")
    .slice(0, 16)
}

export async function createRunRequest(
  suiteId: string,
  modelIds: string[],
): Promise<RunRequest> {
  if (!isRedisConfigured()) {
    throw new Error("Run requests require KV configuration.")
  }

  const [suite, suiteFile, catalog] = await Promise.all([
    getSuite(suiteId),
    getSuiteFile(suiteId),
    getRunRequestModelCatalog(suiteId),
  ])

  if (!suite || !suiteFile) {
    throw new Error(`Suite "${suiteId}" does not exist.`)
  }

  const canonicalIds = [...new Set(modelIds)].sort()
  if (canonicalIds.length === 0) {
    throw new Error("Select at least one model id.")
  }
  if (canonicalIds.length > catalog.length) {
    throw new Error(
      `Select no more than ${catalog.length} models for this suite.`,
    )
  }

  const catalogById = new Map(catalog.map((model) => [model.id, model]))
  const unknownIds = canonicalIds.filter((id) => !catalogById.has(id))
  if (unknownIds.length > 0) {
    throw new Error(`Unknown model id(s): ${unknownIds.join(", ")}`)
  }

  const requestId = getRunRequestId(suiteId, suite.version, canonicalIds)
  const existing = await getStoredRunRequest(requestId)
  if (existing) return existing

  const existingRequests = await listRunRequests(suiteId)
  const openCount = existingRequests.filter(
    (request) => request.status !== "completed",
  ).length
  if (openCount >= MAX_OPEN_REQUESTS_PER_SUITE) {
    throw new Error(
      `This suite already has ${MAX_OPEN_REQUESTS_PER_SUITE} open run requests.`,
    )
  }

  const estimatedCostUsd =
    Math.round(
      suiteFile.tests.length *
        canonicalIds.reduce((sum, id) => {
          const model = catalogById.get(id)
          if (!model || typeof model.estCostPerTest !== "number") {
            throw new Error(`Missing price snapshot for model id: ${id}`)
          }
          return sum + model.estCostPerTest
        }, 0) *
        100,
    ) / 100

  const request: RunRequest = {
    requestId,
    suiteId,
    suiteVersion: suite.version,
    modelIds: canonicalIds,
    modelCount: canonicalIds.length,
    estimatedCostUsd,
    donationAddress: getRunRequestAddress(requestId),
    createdAt: new Date().toISOString(),
    status: "funding",
  }

  await putRunRequest(request)
  return request
}

export async function listRunRequests(suiteId?: string): Promise<RunRequest[]> {
  if (!isRedisConfigured()) return []

  const ids = await getRunRequestIds(suiteId)
  const requests = await Promise.all(ids.map((id) => getStoredRunRequest(id)))
  return requests
    .filter((request): request is RunRequest => request !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getRunRequest(
  requestId: string,
): Promise<RunRequest | null> {
  if (!isRedisConfigured()) return null
  return getStoredRunRequest(requestId)
}

export async function setRunRequestStatus(
  requestId: string,
  status: RunRequestStatus,
): Promise<RunRequest | null> {
  if (!isRedisConfigured()) return null
  return updateRunRequestStatus(requestId, status)
}
