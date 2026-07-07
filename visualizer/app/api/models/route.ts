import { NextResponse } from "next/server"
import { getDefaultModels } from "@/lib/suites"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const models = await getDefaultModels()
    return NextResponse.json({
      count: models.length,
      models,
    })
  } catch (error) {
    console.error("Error fetching model registry:", error)
    return NextResponse.json(
      { error: "Failed to fetch model registry" },
      { status: 500 },
    )
  }
}
