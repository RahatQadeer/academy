import type { AcademyLessonType } from "@/academy/lib/domain";

export function LessonTypeIcon({ type }: { type: AcademyLessonType }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": true,
  } as const;

  if (type === "quiz") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 11.2h.01M6.7 6.5a1.4 1.4 0 012.5.8c0 1-1.3 1.2-1.3 2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "video") {
    return (
      <svg {...common}>
        <rect x="2.2" y="3.5" width="11.6" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6.8 6.2l3.2 1.8-3.2 1.8V6.2z" fill="currentColor" />
      </svg>
    );
  }

  if (type === "scenario") {
    return (
      <svg {...common}>
        <path
          d="M8 2.6l1.2 3.1 3.4.2-2.6 2.1.9 3.2L8 9.4l-2.9 1.8.9-3.2-2.6-2.1 3.4-.2L8 2.6z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "assignment") {
    return (
      <svg {...common}>
        <rect x="3.2" y="2.5" width="9.6" height="11" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.6 6.2h4.8M5.6 8.6h4.8M5.6 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        d="M4 3.2h5.2L12 6v6.8a1 1 0 01-1 1H4a1 1 0 01-1-1V4.2a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M9.1 3.3V6.4H12" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
