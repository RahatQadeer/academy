import type { Contact } from "@/base/types";

/**
 * Whitby-owned types. Base types (User, Workspace, Contact, Company, Document)
 * are imported from @/base/types and never redefined here.
 */

export type ClientType = "individual" | "family" | "company" | "organization";

/** `whitbyos_clients.status` is free text in the schema; these are the values
 *  the Figma uses. Unknown values fall back to neutral styling. */
export type ClientStatus = "active" | "at_risk" | "inactive";

export type Client = {
  id: string;
  workspace_id: string;
  name: string;
  client_type: ClientType;
  /**
   * The firm's own word for what this client is, from its list in Settings →
   * Workspace. Null on clients recorded before 086, which is why every screen
   * falls back to `client_type`.
   */
  classification?: string | null;
  status: string;
  owner_user_id: string;
  primary_contact_id: string | null;
  preferences: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ClientPrimaryContact = Pick<
  Contact,
  "id" | "first_name" | "last_name" | "email" | "phone"
> & {
  timezone?: string | null;
};

/** A row in the Clients list — the Figma columns are
 *  Name · Type · Primary Contact · Active Requests · Status · Last Activity. */
export type ClientListRow = Client & {
  /** Whether the primary contact can actually get into the portal. */
  portal_state?: import("@/whitbyos/lib/portal-state").PortalState;
  primary_contact: ClientPrimaryContact | null;
  active_request_count: number;
  last_activity_at: string;
};
