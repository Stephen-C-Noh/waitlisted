import { httpDuration } from "./metrics";

/** Number of observations recorded for a route/status label pair. */
export async function countFor(route: string, status: string) {
  const { values } = await httpDuration.get();
  return (
    values.find((v) => {
      const labels = v.labels as Record<string, string | number>;
      return (
        v.metricName === "http_request_duration_seconds_count" &&
        labels.route === route &&
        labels.status_code === status
      );
    })?.value ?? 0
  );
}
