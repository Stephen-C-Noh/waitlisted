import { getStaffSession } from "@/lib/auth";
import { Badge } from "@/components/ui";

export default async function DashboardPage() {
  // The proxy guards this route, but re-read the session for display.
  const session = await getStaffSession();

  return (
    <main className="flex min-h-screen flex-col gap-8 px-10 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-label text-xs uppercase tracking-[0.32em] text-primary">
          Waitlisted Dashboard
        </p>
        <h1 className="font-headline text-5xl text-on-surface">
          Welcome, {session?.fullName ?? "Staff"}
        </h1>
        <div className="mt-2">
          <Badge tone="success" pulse>
            {session?.role ?? "UNKNOWN"}
          </Badge>
        </div>
      </header>
      <p className="font-body text-on-surface-variant">
        Waitlist management UI coming soon.
      </p>
    </main>
  );
}
