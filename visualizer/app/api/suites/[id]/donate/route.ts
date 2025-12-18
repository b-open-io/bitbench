import { NextResponse } from "next/server";
import { getSuite, satsToUsd } from "@/lib/suites";
import { addDonation, isRedisConfigured } from "@/lib/kv";
import type { Donation } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface DonateBody {
  txid: string;
  amountSats: number;
  fromAddress?: string;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if Redis is configured
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    // Verify suite exists
    const suite = await getSuite(id);
    if (!suite) {
      return NextResponse.json({ error: "Suite not found" }, { status: 404 });
    }

    // Parse body
    const body: DonateBody = await request.json();

    if (!body.txid || !body.amountSats) {
      return NextResponse.json(
        { error: "Missing required fields: txid, amountSats" },
        { status: 400 }
      );
    }

    // Create donation record
    const donation: Donation = {
      txid: body.txid,
      suiteId: id,
      amountSats: body.amountSats,
      amountUsd: satsToUsd(body.amountSats),
      timestamp: new Date().toISOString(),
      fromAddress: body.fromAddress,
    };

    // Store donation
    await addDonation(donation);

    return NextResponse.json({
      success: true,
      donation,
    });
  } catch (error) {
    console.error("Error recording donation:", error);
    return NextResponse.json(
      { error: "Failed to record donation" },
      { status: 500 }
    );
  }
}
