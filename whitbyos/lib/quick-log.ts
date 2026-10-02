import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

export type RequestOption = { id: string; title: string };

/** The Requests 1.2b and 1.2c offer to hang a log or a note off. */
export async function listRequestOptions(): Promise<RequestOption[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_requests")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (data ?? []) as RequestOption[];
}

/** 1.2b's four kinds, in the export's order. */
export const COMMUNICATION_KINDS = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "message", label: "WhatsApp / Text" },
  { value: "in_person", label: "In Person" },
] as const;
