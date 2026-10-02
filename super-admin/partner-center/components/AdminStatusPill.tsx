import { Pill } from "@/base/components/Pill";

export function AdminStatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const safeTone =
    tone === "info" ||
    tone === "success" ||
    tone === "warning" ||
    tone === "danger"
      ? tone
      : "neutral";
  return <Pill tone={safeTone}>{label || "—"}</Pill>;
}
