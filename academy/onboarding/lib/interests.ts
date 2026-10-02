export const ACADEMY_INTERESTS = [
  {
    id: "certification",
    label: "Professional certification and coordination",
  },
  {
    id: "practice",
    label: "Building or growing a professional practice",
  },
  {
    id: "specialty",
    label: "A specialty capability",
  },
  {
    id: "coordination",
    label: "Whitby and intelligent coordination",
  },
  {
    id: "short-courses",
    label: "Short courses or continuing learning",
  },
  {
    id: "exploring",
    label: "Just exploring",
  },
] as const;

export type AcademyInterestId = (typeof ACADEMY_INTERESTS)[number]["id"];
