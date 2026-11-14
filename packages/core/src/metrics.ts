/**
 * Public metric values are never invented (spec §5, §14). A metric is either
 * backed by stored data, or explicitly unavailable.
 */
export type MetricValue =
  | { status: "available"; value: number; asOf: Date; provenance: string }
  | { status: "unavailable"; reason: string };

export const UNAVAILABLE_LABEL = "Data not yet available";

export function formatMetric(m: MetricValue, format: (n: number) => string = (n) => n.toLocaleString("en-US")): string {
  return m.status === "available" ? format(m.value) : UNAVAILABLE_LABEL;
}
