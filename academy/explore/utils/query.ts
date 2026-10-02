import {
  isAcademyCourseAccess,
  isAcademyProgramType,
  type AcademyCourseAccess,
  type AcademyProgramType,
} from "@/academy/lib/domain";
import {
  courseRecognitionOptions,
  isCertificateClass,
  type CertificateClass,
} from "@/academy/lib/courseMetadata";
import type { ExploreCatalogQuery, ExploreRecognitionFilter, ExploreSort } from "../types";

export type ExploreChipId =
  | "all"
  | "certificate_of_completion"
  | "specialty_endorsement"
  | "professional_certification"
  | "free"
  | "purchased"
  | "professional_plus"
  | "organization_assigned";

export const EXPLORE_CHIPS: { id: ExploreChipId; label: string }[] = [
  { id: "all", label: "All programs" },
  { id: "certificate_of_completion", label: "Certificate of Completion" },
  { id: "specialty_endorsement", label: "Specialty Endorsement" },
  { id: "professional_certification", label: "Professional Credential" },
  { id: "free", label: "Free" },
  { id: "purchased", label: "Paid" },
  { id: "professional_plus", label: "Professional+" },
  { id: "organization_assigned", label: "Organization Assigned" },
];

export const EXPLORE_CERTIFICATE_FILTER_OPTIONS = [
  { value: "all", label: "All certificates" },
  ...courseRecognitionOptions().map((o) => ({ value: o.value, label: o.label })),
];

export const EXPLORE_ACCESS_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "free", label: "Free" },
  { value: "purchased", label: "Paid" },
];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function sanitizeCatalogSearch(raw: string): string {
  return raw
    .trim()
    .slice(0, 80)
    .replace(/[%_,"\\()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSort(value: string): ExploreSort {
  // Legacy `name` = A–Z ascending.
  if (value === "asc" || value === "name") return "asc";
  if (value === "desc") return "desc";
  return "sequence";
}

function recognitionFromLegacyType(type: AcademyProgramType | ""): ExploreRecognitionFilter {
  if (type === "certification_program") return "professional_certification";
  if (type === "endorsement_program") return "specialty_endorsement";
  if (type === "course" || type === "short_course") return "certificate_of_completion";
  return "";
}

export function parseExploreQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ExploreCatalogQuery {
  const typeRaw = firstParam(searchParams.type);
  const recognitionRaw = firstParam(searchParams.recognition);
  const accessRaw = firstParam(searchParams.access);
  const priceRaw = firstParam(searchParams.price);
  const pageRaw = Number.parseInt(firstParam(searchParams.page), 10);

  // Legacy price=free|paid URLs → access filter
  let access: AcademyCourseAccess | "" = isAcademyCourseAccess(accessRaw) ? accessRaw : "";
  let price: "free" | "paid" | "" = "";
  if (!access && (priceRaw === "free" || priceRaw === "paid")) {
    access = priceRaw === "free" ? "free" : "purchased";
    price = priceRaw;
  }

  // Legacy type query values (format) — still accepted, mapped into recognition.
  let type: AcademyProgramType | "" = isAcademyProgramType(typeRaw) ? typeRaw : "";
  if (!type) {
    if (typeRaw === "cpa") type = "certification_program";
    else if (typeRaw === "specialty_endorsement") type = "endorsement_program";
    else if (typeRaw === "intelligent_coordination") type = "short_course";
    else if (
      typeRaw === "professional_practice_accelerator" ||
      typeRaw === "free_course" ||
      typeRaw === "paid_course"
    ) {
      type = "course";
    }
  }

  let recognition: ExploreRecognitionFilter = isCertificateClass(recognitionRaw)
    ? recognitionRaw
    : "";
  if (!recognition) {
    recognition = recognitionFromLegacyType(type);
  }

  return {
    q: sanitizeCatalogSearch(firstParam(searchParams.q)),
    type: "",
    recognition,
    access,
    price,
    sort: parseSort(firstParam(searchParams.sort)),
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? pageRaw : 1,
  };
}

export function activeExploreChip(query: ExploreCatalogQuery): ExploreChipId {
  if (query.recognition === "certificate_of_completion" && !query.access) {
    return "certificate_of_completion";
  }
  if (query.recognition === "specialty_endorsement" && !query.access) {
    return "specialty_endorsement";
  }
  if (query.recognition === "professional_certification" && !query.access) {
    return "professional_certification";
  }
  if (query.access === "free" && !query.recognition) return "free";
  if (query.access === "purchased" && !query.recognition) return "purchased";
  if (query.access === "professional_plus" && !query.recognition) return "professional_plus";
  if (query.access === "organization_assigned" && !query.recognition) {
    return "organization_assigned";
  }
  if (!query.recognition && !query.access) return "all";
  return "all";
}

export function queryFromChip(chip: ExploreChipId, query: ExploreCatalogQuery): ExploreCatalogQuery {
  const next = {
    q: query.q,
    sort: query.sort,
    type: "" as AcademyProgramType | "",
    recognition: "" as ExploreRecognitionFilter,
    access: "" as AcademyCourseAccess | "",
    price: "" as const,
    page: 1,
  };
  if (chip === "certificate_of_completion") {
    return { ...next, recognition: "certificate_of_completion" };
  }
  if (chip === "specialty_endorsement") {
    return { ...next, recognition: "specialty_endorsement" };
  }
  if (chip === "professional_certification") {
    return { ...next, recognition: "professional_certification" };
  }
  if (chip === "free") return { ...next, access: "free" };
  if (chip === "purchased") return { ...next, access: "purchased" };
  if (chip === "professional_plus") return { ...next, access: "professional_plus" };
  if (chip === "organization_assigned") return { ...next, access: "organization_assigned" };
  return next;
}

export function exploreHref(query: ExploreCatalogQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.recognition) params.set("recognition", query.recognition);
  if (query.access) params.set("access", query.access);
  if (query.sort === "asc" || query.sort === "desc") params.set("sort", query.sort);
  if ((query.page ?? 1) > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `/academy/explore?${qs}` : "/academy/explore";
}

export function programDetailHref(programId: string): string {
  return `/academy/explore/${programId}`;
}

export function hasActiveFilters(query: ExploreCatalogQuery): boolean {
  return Boolean(query.q || query.recognition || query.access);
}

/** True when program matches the certificate classification filter. */
export function matchesCertificateFilter(
  program: { recognition: string },
  recognition: ExploreRecognitionFilter | CertificateClass | "",
): boolean {
  if (!recognition) return true;
  if (recognition === "certificate_of_completion") {
    return (
      program.recognition === "certificate_of_completion" || program.recognition === "none"
    );
  }
  return program.recognition === recognition;
}

export function matchesCatalogSearch(
  program: { name: string; description: string | null; category: string | string[] | null },
  q: string,
): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const category = Array.isArray(program.category)
    ? program.category.map(String).join(" ")
    : (program.category ?? "");
  return (
    program.name.toLowerCase().includes(needle) ||
    (program.description ?? "").toLowerCase().includes(needle) ||
    category.toLowerCase().includes(needle)
  );
}
