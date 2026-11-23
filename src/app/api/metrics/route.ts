import { register } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (process.env.METRICS_TOKEN && !request.headers.get("authorization")) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return new Response(await register.metrics(), {
        headers: { "Content-Type": register.contentType },
    });
}
