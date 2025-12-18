import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthToken, parseAuthToken } from "bitcoin-auth";
import { getMasterPublicKey, isMasterWifConfigured } from "@/lib/addresses";
import {
  getQuestionBreakdown,
  setQuestionBreakdown,
  isRedisConfigured,
} from "@/lib/kv";
import type { SuiteQuestionBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - retrieve question breakdown from KV
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get("version") ?? undefined;

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: "Redis not configured" },
        { status: 500 }
      );
    }

    const breakdown = await getQuestionBreakdown(id, version);

    if (!breakdown) {
      return NextResponse.json(
        { error: "No question breakdown found for this suite" },
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

// POST - store question breakdown (authenticated)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: suiteId } = await params;

  // Check configuration
  if (!isRedisConfigured()) {
    return NextResponse.json(
      { error: "Redis not configured" },
      { status: 500 }
    );
  }

  if (!isMasterWifConfigured()) {
    return NextResponse.json(
      { error: "Server not configured for authentication" },
      { status: 500 }
    );
  }

  // Get auth token from header
  const authToken = request.headers.get("bitcoin-auth-token");
  if (!authToken) {
    return NextResponse.json(
      { error: "Missing Bitcoin-Auth-Token header" },
      { status: 401 }
    );
  }

  // Parse token to get pubkey
  const parsedToken = parseAuthToken(authToken);
  if (!parsedToken) {
    return NextResponse.json(
      { error: "Invalid auth token format" },
      { status: 401 }
    );
  }

  // Verify pubkey matches expected (from MASTER_WIF)
  const expectedPubkey = getMasterPublicKey();
  if (parsedToken.pubkey !== expectedPubkey) {
    return NextResponse.json(
      { error: "Unauthorized: pubkey mismatch" },
      { status: 403 }
    );
  }

  // Get request body
  const body = await request.text();
  if (!body) {
    return NextResponse.json(
      { error: "Missing request body" },
      { status: 400 }
    );
  }

  // Verify signature
  const requestPath = `/api/suites/${suiteId}/questions`;
  const isValid = verifyAuthToken(authToken, {
    requestPath,
    timestamp: new Date().toISOString(),
    body,
  });

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  // Parse and validate payload
  let payload: SuiteQuestionBreakdown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate suite ID matches
  if (payload.suiteId !== suiteId) {
    return NextResponse.json(
      { error: "Suite ID mismatch" },
      { status: 400 }
    );
  }

  try {
    // Store question breakdown in KV
    await setQuestionBreakdown(suiteId, payload.version, payload);

    return NextResponse.json({
      success: true,
      message: "Question breakdown stored successfully",
    });
  } catch (error) {
    console.error("Failed to store question breakdown:", error);
    return NextResponse.json(
      { error: "Failed to store question breakdown" },
      { status: 500 }
    );
  }
}
