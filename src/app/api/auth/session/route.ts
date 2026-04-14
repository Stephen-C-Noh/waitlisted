import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";

export async function GET() {
  const session = await getStaffSession();
  return NextResponse.json({ session });
}
