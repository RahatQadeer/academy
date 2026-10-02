export type UserStatus = "active" | "suspended" | "deleted";

export type WorkspaceMemberRole =
  | "owner"
  | "admin"
  | "team_lead"
  | "coordinator"
  | "billing"
  | "viewer";

export type WorkspaceMemberStatus = "active" | "invited" | "suspended";

export type ProductKey =
  | "whitbyos"
  | "client_portal"
  | "academy"
  | "partner_center";

export type EntitlementStatus = "active" | "trial" | "expired" | "revoked";

export type InvitationContextType =
  | "team_member"
  | "client_member"
  | "client_authorized_user"
  | "partner_team"
  | "academy_instructor"
  | "academy_admin";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type DocumentVisibility = "internal" | "client_visible" | "restricted";

export type DocumentStatus =
  | "current"
  | "action_needed"
  | "completed"
  | "archived";

export type DocumentContextType =
  | "client"
  | "request"
  | "workstream"
  | "partner_profile"
  | "company"
  | "contact";

export type TaxonomySensitivity = "normal" | "sensitive";

export type User = {
  id: string;
  email: string;
  password_hash: string | null;
  oauth_provider: string | null;
  oauth_id: string | null;
  full_name: string;
  preferred_name: string | null;
  salutation: string | null;
  phone: string | null;
  avatar_url: string | null;
  /** What they call their job — the role asked for on setup step 1. */
  title_role: string | null;
  timezone: string;
  status: UserStatus;
  last_login_at: string | null;
  /** When this person finished or skipped the welcome tour (1.4 to 1.9). */
  tour_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  url_slug: string;
  logo_url: string | null;
  team_size: string | null;
  timezone: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  created_at: string;
};

export type Entitlement = {
  id: string;
  user_id: string;
  product: ProductKey;
  workspace_id: string | null;
  status: EntitlementStatus;
  is_default_landing: boolean;
  created_at: string;
  updated_at: string;
};

export type InvitationToken = {
  id: string;
  token: string;
  inviter_user_id: string;
  invitee_email: string;
  invitee_name: string | null;
  context_type: InvitationContextType;
  context_id: string;
  role_or_relationship: string;
  status: InvitationStatus;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  created_by: string;
};

export type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  salutation: string | null;
  email: string | null;
  phone: string | null;
  title_role: string | null;
  source: string | null;
  enrichment_data: Record<string, unknown> | null;
  created_by_workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  name: string;
  website: string | null;
  industry_type: string | null;
  addresses: unknown;
  markets: unknown;
  audience_served: string | null;
  enrichment_data: Record<string, unknown> | null;
  created_by_workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  title: string;
  file_url: string;
  context_type: DocumentContextType;
  context_id: string;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  version: number;
  effective_date: string | null;
  signed_date: string | null;
  superseded_by_document_id: string | null;
  uploaded_by_user_id: string | null;
  shared_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionProfile = {
  user: User;
  entitlements: Entitlement[];
  workspaces: Workspace[];
};
