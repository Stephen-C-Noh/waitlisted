import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";

/** Staff-only: list all tables with current status. */
export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tables = await prisma.tables.findMany({
    orderBy: [{ zone: "asc" }, { table_number: "asc" }],
    select: {
      id: true,
      table_number: true,
      capacity: true,
      zone: true,
      status: true,
      current_server_id: true,
    },
  });

  return NextResponse.json(tables);
}
