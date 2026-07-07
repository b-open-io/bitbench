const WOC_EXCHANGE_RATE_URL =
  "https://api.whatsonchain.com/v1/bsv/main/exchangerate"

interface WocExchangeRateResponse {
  rate?: unknown
}

export async function getBsvPriceUsd(): Promise<number> {
  const response = await fetch(WOC_EXCHANGE_RATE_URL, {
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch BSV/USD exchange rate from WhatsOnChain: ${response.status}`,
    )
  }

  const data = (await response.json()) as WocExchangeRateResponse
  if (typeof data.rate !== "number" || data.rate <= 0) {
    throw new Error("Invalid BSV/USD exchange rate from WhatsOnChain")
  }

  return data.rate
}
