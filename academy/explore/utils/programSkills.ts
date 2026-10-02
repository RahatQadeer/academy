export function aggregateProgramSkills(input: {
  lessonObjectives: unknown;
  category: string | string[] | null;
}): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  const rows = Array.isArray(input.lessonObjectives) ? input.lessonObjectives : [];

  for (const objectives of rows) {
    const list = Array.isArray(objectives)
      ? objectives
      : typeof objectives === "string"
        ? [objectives]
        : [];
    for (const raw of list) {
      const skill = String(raw).trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push(skill);
    }
  }

  if (skills.length) return skills;

  const category =
    typeof input.category === "string"
      ? input.category
      : Array.isArray(input.category)
        ? input.category.map(String).join(", ")
        : "";

  if (category.trim()) {
    return category
      .split(/[,;|/]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

export function formatSkillsGained(skills: string[]): string {
  return skills.join(", ");
}
