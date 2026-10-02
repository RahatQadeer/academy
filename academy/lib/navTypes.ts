export type AcademyNavBadgeKey =
  | "enrollments"
  | "pendingApprovals"
  | "credentialReview"
  | "pendingReviews";

export type AcademyNavItem = {
  href: string;
  label: string;
  badgeKey?: AcademyNavBadgeKey;
};

export type AcademyNavGroup = {
  label: string;
  items: AcademyNavItem[];
};

export type AcademyNavBadges = Partial<Record<AcademyNavBadgeKey, number>>;
