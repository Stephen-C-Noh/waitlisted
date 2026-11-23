import { timingSafeEqual } from "node:crypto";
import { register } from "@/lib/metrics";

export const dynamic = "force-dynamic";

function authorized(request: Request, token: string): boolean {
    const given = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${token}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
    // Trim: tokens mounted from secret files usually end in a newline.
    const token = process.env.METRICS_TOKEN?.trim();
    if (!token && process.env.NODE_ENV === "production") {
        return new Response(null, { status: 404 });
    }
    if (token && !authorized(request, token)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return new Response(await register.metrics(), {
        headers: { "Content-Type": register.contentType },
    });
}
