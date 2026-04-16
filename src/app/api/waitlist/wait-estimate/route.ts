import { NextRequest, NextResponse } from "next/server";
import { WaitEstimateQuery } from "@/lib/validations";
import { estimateWaitMinutes } from "@/lib/wait-time";

export async function GET(request: NextRequest) {
  const partyRaw = request.nextUrl.searchParams.get("partySize");
  const parsed = WaitEstimateQuery.safeParse({ partySize: partyRaw });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid partySize parameter" },
      { status: 400 },
    );
  }

  const estimate = await estimateWaitMinutes(parsed.data.partySize);
  return NextResponse.json(estimate);
}
