export type ProgramPublicationStatus = "published" | "already_published";

export type ProgramPublicationFailure =
  | "unauthenticated"
  | "unauthorized"
  | "not_found"
  | "not_approved"
  | "invalid_state"
  | "failed";

export type ProgramPublicationResult =
  | {
      ok: true;
      status: ProgramPublicationStatus;
      programId: string;
      publishedAt: string | null;
      publishedByUserId: string | null;
    }
  | { ok: false; reason: ProgramPublicationFailure; message?: string };
