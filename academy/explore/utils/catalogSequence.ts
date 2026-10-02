import type { AcademyCourseRecognition, AcademyProgramType } from "@/academy/lib/domain";
import type { ExploreCatalogQuery, ExploreProgramCard } from "../types";

/** Default catalog order still uses DB type (kept in sync with certificate class). */
export const CATALOG_SEQUENCE: AcademyProgramType[] = [
  "certification_program",
  "endorsement_program",
  "course",
  "short_course",
];

const NEW_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;

export const CATALOG_SECTIONS: {
  id: string;
  types: AcademyProgramType[];
  recognitions: AcademyCourseRecognition[];
  title: string;
  description: string;
}[] = [
  {
    id: "professional",
    types: ["certification_program"],
    recognitions: ["professional_certification"],
    title: "Professional Credential",
    description: "Formal professional credentials — including Certified Private Attaché.",
  },
  {
    id: "endorsements",
    types: ["endorsement_program"],
    recognitions: ["specialty_endorsement"],
    title: "Specialty Endorsement",
    description: "Specialty Endorsements. Purchasable independently of CPA.",
  },
  {
    id: "completion",
    types: ["course", "short_course"],
    recognitions: ["certificate_of_completion", "none"],
    title: "Certificate of Completion",
    description: "Courses and short programs that award a Certificate of Completion.",
  },
];

export function catalogTypeRank(type: AcademyProgramType) {
  const index = CATALOG_SEQUENCE.indexOf(type);
  return index === -1 ? CATALOG_SEQUENCE.length : index;
}

export function sortCatalogPrograms<T extends { name: string; type: AcademyProgramType }>(
  programs: T[],
  sort: ExploreCatalogQuery["sort"],
): T[] {
  return [...programs].sort((a, b) => {
    const nameA = a.name ?? "";
    const nameB = b.name ?? "";
    if (sort === "asc") return nameA.localeCompare(nameB);
    if (sort === "desc") return nameB.localeCompare(nameA);
    const rank = catalogTypeRank(a.type) - catalogTypeRank(b.type);
    if (rank !== 0) return rank;
    return nameA.localeCompare(nameB);
  });
}

export function isNewCatalogProgram(program: { createdAt?: string | null }, now = Date.now()) {
  if (!program.createdAt) return false;
  const created = Date.parse(program.createdAt);
  if (!Number.isFinite(created)) return false;
  return now - created <= NEW_WINDOW_MS;
}

function programInSection(
  program: ExploreProgramCard,
  section: (typeof CATALOG_SECTIONS)[number],
): boolean {
  if (section.recognitions.includes(program.recognition)) return true;
  // Fallback for odd/legacy rows where recognition is missing but type matches.
  return section.types.includes(program.type) && !program.recognition;
}

export function groupCatalogPrograms(programs: ExploreProgramCard[]) {
  const newPrograms = programs.filter((program) => isNewCatalogProgram(program));
  const sections = [
    ...(newPrograms.length > 0
      ? [
          {
            id: "new",
            types: [] as AcademyProgramType[],
            recognitions: [] as AcademyCourseRecognition[],
            title: "New",
            description: "Recently published learning.",
            programs: newPrograms,
          },
        ]
      : []),
    ...CATALOG_SECTIONS.map((section) => ({
      ...section,
      programs: programs.filter((program) => programInSection(program, section)),
    })).filter((section) => section.programs.length > 0),
  ];
  return sections;
}

export function shouldGroupCatalog(query: ExploreCatalogQuery) {
  return !query.q && !query.recognition && !query.access && query.sort === "sequence";
}
