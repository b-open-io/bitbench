import { NextResponse } from "next/server";
import { getAllSuitesWithBalance } from "@/lib/suites";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const suites = await getAllSuitesWithBalance();
    return NextResponse.json({ suites });
  } catch (error) {
    console.error("Error fetching suites:", error);
    return NextResponse.json(
      { error: "Failed to fetch suites" },
      { status: 500 }
    );
  }
}
