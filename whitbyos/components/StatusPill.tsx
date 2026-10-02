import { Pill } from "@/base/components/Pill";
import { statusLabel } from "@/whitbyos/lib/format";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

/**
 * One place that maps Whitby's status vocabulary onto the shared Pill tones,
 * so Clients, Requests and Tasks never colour the same word differently.
 */
const TONES: Record<string, Tone> = {
  // client
  active: "success",
  at_risk: "danger",
  inactive: "neutral",
  // request / workplan
  running: "info",
  approval: "warning",
  manual: "neutral",
  auto: "success",
  open: "info",
  not_started: "neutral",
  in_progress: "info",
  blocked: "danger",
  overdue: "danger",
  draft: "neutral",
  paused: "neutral",
  waiting: "warning",
  complete: "success",
  completed: "success",
  closed: "neutral",
};

export function StatusPill({ status }: { status: string }) {
  const key = status?.toLowerCase().replace(/\s+/g, "_") ?? "";
  return <Pill tone={TONES[key] ?? "neutral"}>{statusLabel(status)}</Pill>;
}
