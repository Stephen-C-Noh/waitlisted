import { getStaffSession } from "@/lib/auth";
import { isPosIntegrationEnabled } from "@/lib/spring-boot-client";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await getStaffSession();

  return (
    <DashboardClient
      staffName={session?.fullName ?? "Staff"}
      staffRole={session?.role ?? "UNKNOWN"}
      posEnabled={isPosIntegrationEnabled()}
    />
  );
}
