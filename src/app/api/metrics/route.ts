import { createHash, timingSafeEqual } from "node:crypto";
import { register } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const digest = (s: string) => createHash("sha256").update(s).digest();

function authorized(request: Request, token: string): boolean {
    const header = request.headers.get("authorization") ?? "";
    const space = header.indexOf(" ");
    const scheme = space === -1 ? header : header.slice(0, space);
    const given = space === -1 ? "" : header.slice(space + 1);
    // Equal-length digests: no length branch, so timing reveals nothing about the token.
    const tokenMatches = timingSafeEqual(digest(given), digest(token));
    return scheme.toLowerCase() === "bearer" && tokenMatches;
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
