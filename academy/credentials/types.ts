import type {
  AcademyCredentialStatus,
  AcademyCredentialType,
  AcademyProgramType,
} from "@/academy/lib/domain";

export const CREDENTIALS_LIMIT = 48;

export type CredentialItem = {
  id: string;
  programId: string;
  programName: string;
  programType: AcademyProgramType | null;
  type: AcademyCredentialType;
  status: AcademyCredentialStatus;
  awardedAt: string | null;
  expiresAt: string | null;
  renewalStatus: string | null;
  assignmentTotal: number;
  assignmentSubmitted: number;
  assignmentReviewed: number;
  certificateLocked: boolean;
};

export type CredentialsData = {
  items: CredentialItem[];
  truncated: boolean;
};

export type CredentialsLoadResult =
  | { ok: true; data: CredentialsData }
  | { ok: false };
