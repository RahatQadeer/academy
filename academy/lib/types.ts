export type AcademyRole = "learner" | "instructor" | "admin" | "super_admin";

export type AcademyActor = {
  id: string;
};

export type AcademyMembership = {
  id: string;
  user_id: string;
  role: AcademyRole;
  status: "active" | "suspended";
  granted_by_user_id: string | null;
  granted_at: string;
  created_at: string;
  updated_at: string;
};
