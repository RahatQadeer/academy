import { Pill } from "@/base/components/Pill";
import type { StatusView } from "@/client-portal/lib/status";

export function StatusPill({ status }: { status: StatusView }) {
  return <Pill tone={status.tone}>{status.label}</Pill>;
}
