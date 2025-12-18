import { NextResponse } from "next/server";
import { getSuiteWithBalance } from "@/lib/suites";
import { getDonations, getLatestRun, getBenchmarkRuns } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const suite = await getSuiteWithBalance(id);

    if (!suite) {
      return NextResponse.json({ error: "Suite not found" }, { status: 404 });
    }

    // Get additional data
    const [donations, latestRun, runs] = await Promise.all([
      getDonations(id, 20),
      getLatestRun(id),
      getBenchmarkRuns(id, 10),
    ]);

    return NextResponse.json({
      suite,
      donations,
      latestRun,
      runs,
    });
  } catch (error) {
    console.error("Error fetching suite:", error);
    return NextResponse.json(
      { error: "Failed to fetch suite" },
      { status: 500 }
    );
  }
}
