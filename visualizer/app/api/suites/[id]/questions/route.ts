import { NextResponse } from "next/server";
import { getQuestionBreakdown } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get("version") ?? undefined;

    const breakdown = await getQuestionBreakdown(id, version);

    if (!breakdown) {
      return NextResponse.json(
        { error: "No cached results found for this suite" },
        { status: 404 }
      );
    }

    return NextResponse.json(breakdown);
  } catch (error) {
    console.error("Error fetching question breakdown:", error);
    return NextResponse.json(
      { error: "Failed to fetch question breakdown" },
      { status: 500 }
    );
  }
}
