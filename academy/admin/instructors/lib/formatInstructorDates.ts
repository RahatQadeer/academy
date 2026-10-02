function formatActivityWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return `today, ${new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)}`;
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return "yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

export function formatInstructorSince(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatInstructorActivityWhen(value: string) {
  return formatActivityWhen(value);
}

export function formatAssignmentCoverage(
  moduleIds: string[],
  modules: { id: string; title: string; sortOrder: number }[],
): string {
  const selected = moduleIds.filter(Boolean);
  if (selected.length === 0 || (modules.length > 0 && selected.length >= modules.length)) {
    return "Full program";
  }

  const byId = new Map(modules.map((module) => [module.id, module]));
  const named = selected
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => (a!.sortOrder - b!.sortOrder));

  if (named.length === 1) {
    const module = named[0]!;
    return `Module ${module.sortOrder + 1} — ${module.title}`;
  }

  if (named.length > 1) {
    return `${named.length} of ${modules.length || named.length} modules`;
  }

  return `${selected.length} module${selected.length === 1 ? "" : "s"}`;
}

export function formatAssignmentCardTitle(
  programName: string,
  moduleIds: string[],
  modules: { id: string; title: string; sortOrder: number }[],
) {
  return `${programName} — ${formatAssignmentCoverage(moduleIds, modules)}`;
}
