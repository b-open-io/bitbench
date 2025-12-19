import { NextResponse } from "next/server";
import { getSuiteFile } from "@/lib/suites";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const suiteFile = await getSuiteFile(id);

    if (!suiteFile) {
      return NextResponse.json({ error: "Suite not found" }, { status: 404 });
    }

    return NextResponse.json(suiteFile);
  } catch (error) {
    console.error("Error fetching suite details:", error);
    return NextResponse.json(
      { error: "Failed to fetch suite details" },
      { status: 500 }
    );
  }
}
