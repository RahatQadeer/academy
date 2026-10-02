type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "square" as const,
  strokeLinejoin: "miter" as const,
};

export function NavIcon({ href, label }: { href: string; label: string }) {
  const key = `${href} ${label}`.toLowerCase();
  const labelOnly = label.toLowerCase().trim();

  if (key.includes("question-bank") || key.includes("question bank")) return <QuestionBankIcon />;
  if (key.includes("/programs") || labelOnly === "programs") return <BookIcon />;
  // Instructors before Learners — hrefs share /admin/ and labels must not collide.
  if (
    key.includes("/admin/instructors") ||
    labelOnly === "instructors" ||
    labelOnly === "instructor"
  ) {
    return <InstructorsIcon />;
  }
  if (
    key.includes("/admin/enrollments") ||
    labelOnly === "learners" ||
    labelOnly === "learner"
  ) {
    return <LearnersIcon />;
  }
  if (key.includes("/instructor/reviews") || key.includes("assignment review")) return <ClipboardIcon />;
  if (key.includes("/admin/approval") || key.includes("pending")) return <ClipboardIcon />;
  if (key.includes("/admin/admin") || key.includes("academy admin")) return <ShieldIcon />;
  if (key.includes("/admin/settings") || key.includes("setting")) return <GearIcon />;
  // Verify before certificate — otherwise AwardIcon also matches "certificate".
  if (key.includes("/verify") || labelOnly === "verify" || key.includes("verify certificate")) {
    return <VerifyIcon />;
  }
  if (key.includes("credential") || key.includes("certificate")) return <AwardIcon />;
  if (
    key.includes("dashboard") ||
    href === "/academy" ||
    href === "/academy/instructor" ||
    href === "/academy/admin"
  ) {
    return <HomeIcon />;
  }
  if (key.includes("/admin") || key.includes("catalog")) return <BookIcon />;
  if (key.includes("/learning") || key.includes("my learning")) return <BookOpenIcon />;
  if (key.includes("/explore")) return <CompassIcon />;
  if (key.includes("/resource")) return <FolderIcon />;
  /*
   * Whitby's own seventeen, before the shared fallbacks below.
   *
   * These used to fall through to the dot grid, which is what a rail closed to
   * its icons cannot afford: eight identical grids down one column is a column
   * nobody can navigate by.
   */
  // Home was falling through to the dot grid, which is the icon for "no idea
   // what this is" — on the one item every product opens with.
   if (labelOnly === "home" || href === "/whitbyos" || href === "/client-portal") {
    return <HomeIcon />;
  }
  if (key.includes("work-plan") || key.includes("work plan")) return <LayersIcon />;
  if (key.includes("playbook")) return <BookIcon />;
  if (key.includes("provider")) return <BuildingIcon />;
  if (key.includes("update")) return <MegaphoneIcon />;
  if (key.includes("/forms") || labelOnly === "forms") return <ClipboardIcon />;
  if (key.includes("knowledge")) return <BookOpenIcon />;
  if (key.includes("integration")) return <PlugIcon />;
  if (key.includes("workspace")) return <GridIcon />;
  if (key.includes("waiting")) return <ClockIcon />;
  // Reports and Insights are both charts and must not be the same chart.
  if (key.includes("report")) return <ReportIcon />;

  /*
   * Whitby's Clients screen — and only it.
   *
   * This matched the bare word, and every address in the Client Portal begins
   * "/client-portal": Requests, Tasks, Calendar, Messages, Documents and
   * Billing all fell in here and were drawn as two people. Six rows of one
   * glyph is a rail you cannot navigate by shape at all, and closed to its
   * icons it is six identical smudges in a column.
   *
   * The address rather than the word, so the item this is for — which is
   * relabelled "Client" while one workspace is open — keeps it either way.
   */
  if (key.includes("/clients")) return <PeopleIcon />;
  if (key.includes("contact")) return <PersonIcon />;
  if (key.includes("request")) return <InboxIcon />;
  if (key.includes("task")) return <CheckIcon />;
  if (key.includes("calendar")) return <CalendarIcon />;
  if (key.includes("message")) return <ChatIcon />;
  if (key.includes("document")) return <FileIcon />;
  if (key.includes("insight")) return <ChartIcon />;
  /*
   * Money, on both rails.
   *
   * Whitby's Invoices and the portal's Billing are the same subject read from
   * the two sides of it, and both were falling through to the dot grid — the
   * glyph for "no idea what this is", on the one row in either rail that is
   * about being paid.
   */
  if (key.includes("billing") || key.includes("invoice")) return <CardIcon />;
  return <DotGridIcon />;
}

/** A card, for the rows about money — see the note where this is chosen. */
function CardIcon() {
  return (
    <Icon>
      <rect x="2" y="3.8" width="12" height="8.4" rx="0.75" {...stroke} />
      <path d="M2 6.6h12" {...stroke} />
      <path d="M4.4 9.8h2.6" {...stroke} />
    </Icon>
  );
}

function HomeIcon() {
  return (
    <Icon>
      <path d="M2.5 7.2L8 2.5l5.5 4.7V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V7.2z" {...stroke} />
      <path d="M6 13.5V9h4v4.5" {...stroke} />
    </Icon>
  );
}

function BookIcon() {
  return (
    <Icon>
      <path d="M3 3.2h7.2A2.3 2.3 0 0 1 12.5 5.5V13H5.2A2.2 2.2 0 0 0 3 13.2V3.2z" {...stroke} />
      <path d="M3 13.2A2.2 2.2 0 0 1 5.2 11H12.5" {...stroke} />
    </Icon>
  );
}

function QuestionBankIcon() {
  return (
    <Icon>
      <rect x="2.5" y="2.8" width="7.2" height="9.8" rx="1.2" {...stroke} />
      <path d="M4.5 5.4h3.4M4.5 7.4h2.4M4.5 9.4h3" {...stroke} />
      <circle cx="11.6" cy="10.2" r="2.5" {...stroke} />
      <path d="M11.6 9.2c0-.6.45-.95 1-.95.55 0 .95.35.95.85 0 .65-.75.85-.95 1.25" {...stroke} />
      <circle cx="11.6" cy="11.75" r=".35" fill="currentColor" stroke="none" />
    </Icon>
  );
}

function BookOpenIcon() {
  return (
    <Icon>
      <path d="M8 4.2c-1.4-1-3.1-1.4-5.2-1.2v8.6c2.1-.2 3.8.2 5.2 1.2 1.4-1 3.1-1.4 5.2-1.2V3c-2.1-.2-3.8.2-5.2 1.2z" {...stroke} />
      <path d="M8 4.4v8.4" {...stroke} />
    </Icon>
  );
}

function PeopleIcon() {
  return (
    <Icon>
      <circle cx="6" cy="5.2" r="1.8" {...stroke} />
      <path d="M2.8 12.4c.3-2 1.6-3.1 3.2-3.1s2.9 1.1 3.2 3.1" {...stroke} />
      <circle cx="11.2" cy="5.6" r="1.5" {...stroke} />
      <path d="M10.2 9.5c1.3.2 2.3 1.1 2.6 2.9" {...stroke} />
    </Icon>
  );
}

/** Graduation cap — Learners (students enrolled in courses). */
function LearnersIcon() {
  return (
    <Icon>
      <path d="M1.8 6.8 8 3.4l6.2 3.4L8 10.2 1.8 6.8z" {...stroke} />
      <path d="M4 8.1v2.8c0 1.15 1.8 2.1 4 2.1s4-.95 4-2.1V8.1" {...stroke} />
      <path d="M14.2 6.8v3.6" {...stroke} />
    </Icon>
  );
}

/** People — Instructors (teachers assigned to programs). */
function InstructorsIcon() {
  return (
    <Icon>
      <circle cx="6" cy="5.2" r="1.8" {...stroke} />
      <path d="M2.8 12.4c.3-2 1.6-3.1 3.2-3.1s2.9 1.1 3.2 3.1" {...stroke} />
      <circle cx="11.2" cy="5.6" r="1.5" {...stroke} />
      <path d="M10.2 9.5c1.3.2 2.3 1.1 2.6 2.9" {...stroke} />
    </Icon>
  );
}

function PersonIcon() {
  return (
    <Icon>
      <circle cx="8" cy="5.2" r="2" {...stroke} />
      <path d="M3.4 13c.4-2.5 2-3.8 4.6-3.8s4.2 1.3 4.6 3.8" {...stroke} />
    </Icon>
  );
}

function ClipboardIcon() {
  return (
    <Icon>
      <rect x="3.5" y="3.5" width="9" height="10.5" rx="0.75" {...stroke} />
      <path d="M6 3.5V3a2 2 0 0 1 4 0v.5" {...stroke} />
      <path d="M6 8.2h4M6 10.8h2.5" {...stroke} />
    </Icon>
  );
}

function ShieldIcon() {
  return (
    <Icon>
      <path d="M8 2.5l5 1.6v4.4c0 2.8-1.9 4.8-5 5.5-3.1-.7-5-2.7-5-5.5V4.1L8 2.5z" {...stroke} />
    </Icon>
  );
}

function AwardIcon() {
  return (
    <Icon>
      <circle cx="8" cy="6.2" r="3.2" {...stroke} />
      <path d="M6.2 9.1 5 13.5l3-1.3 3 1.3-1.2-4.4" {...stroke} />
    </Icon>
  );
}

/** Shield with check — public certificate verification. */
function VerifyIcon() {
  return (
    <Icon>
      <path
        d="M8 1.8 13.2 4v3.6c0 3.2-2.2 5.5-5.2 6.6C5 13.1 2.8 10.8 2.8 7.6V4L8 1.8Z"
        {...stroke}
      />
      <path d="m5.7 7.6 1.7 1.7 3.1-3.5" {...stroke} />
    </Icon>
  );
}

function CompassIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8" r="5.2" {...stroke} />
      <path d="M9.8 6.2 7.1 7.1 6.2 9.8l2.7-.9 1-2.7z" {...stroke} />
    </Icon>
  );
}

function FolderIcon() {
  return (
    <Icon>
      <path d="M2.8 4.4h3.2l1.2 1.4h6.2v6.8H2.8V4.4z" {...stroke} />
    </Icon>
  );
}

function InboxIcon() {
  return (
    <Icon>
      <path d="M2.8 4.2h10.4v8.6H2.8V4.2z" {...stroke} />
      <path d="M2.8 9.2h2.4l.8 1.4h4l.8-1.4h2.4" {...stroke} />
    </Icon>
  );
}

function CheckIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="10" height="10" rx="0.75" {...stroke} />
      <path d="M5.4 8.1 7.1 9.8 10.6 6.2" {...stroke} />
    </Icon>
  );
}

function CalendarIcon() {
  return (
    <Icon>
      <rect x="2.8" y="3.8" width="10.4" height="9.4" rx="0.75" {...stroke} />
      <path d="M2.8 7h10.4M6 2.8v2.2M10 2.8v2.2" {...stroke} />
    </Icon>
  );
}

function ChatIcon() {
  return (
    <Icon>
      <path d="M3 3.5h10a1.2 1.2 0 0 1 1.2 1.2v5.2A1.2 1.2 0 0 1 13 11.1H7.2L3.4 13.4V4.7A1.2 1.2 0 0 1 4.6 3.5H3z" {...stroke} />
    </Icon>
  );
}

function FileIcon() {
  return (
    <Icon>
      <path d="M4.2 2.8h5.2L12.5 6v7.2H4.2V2.8z" {...stroke} />
      <path d="M9.2 2.8V6h3.3" {...stroke} />
    </Icon>
  );
}

function GearIcon() {
  return (
    <Icon>
      <path
        d="M6.35 1.85h3.3l.28 1.42c.48.14.92.38 1.3.68l1.38-.55 1.65 2.86-1.18.9c.1.32.16.66.16 1.04 0 .38-.06.72-.16 1.04l1.18.9-1.65 2.86-1.38-.55c-.38.3-.82.54-1.3.68l-.28 1.42h-3.3l-.28-1.42a4.7 4.7 0 0 1-1.3-.68l-1.38.55-1.65-2.86 1.18-.9A3.9 3.9 0 0 1 2.7 8c0-.38.06-.72.16-1.04l-1.18-.9 1.65-2.86 1.38.55c.38-.3.82-.54 1.3-.68L6.35 1.85z"
        {...stroke}
      />
      <circle cx="8" cy="8" r="2.05" {...stroke} />
    </Icon>
  );
}

function ChartIcon() {
  return (
    <Icon>
      <path d="M2.8 13.2h10.4" {...stroke} />
      <path d="M4.5 13.2V8.2M8 13.2V4.8M11.5 13.2V6.5" {...stroke} />
    </Icon>
  );
}

function DotGridIcon() {
  return (
    <Icon>
      <circle cx="5" cy="5" r="1" fill="currentColor" />
      <circle cx="11" cy="5" r="1" fill="currentColor" />
      <circle cx="5" cy="11" r="1" fill="currentColor" />
      <circle cx="11" cy="11" r="1" fill="currentColor" />
    </Icon>
  );
}

function LayersIcon() {
  return (
    <Icon>
      <path d="M8 2.2 2.4 5.1 8 8l5.6-2.9L8 2.2z" {...stroke} />
      <path d="M2.4 8.4 8 11.3l5.6-2.9" {...stroke} />
      <path d="M2.4 11.5 8 14.4l5.6-2.9" {...stroke} />
    </Icon>
  );
}

function BuildingIcon() {
  return (
    <Icon>
      <rect x="2.6" y="2.6" width="6.4" height="11" rx="1" {...stroke} />
      <path d="M9 6.4h3.2a1 1 0 0 1 1 1v6.2H9" {...stroke} />
      <path d="M4.6 5.2h2.2M4.6 7.6h2.2M4.6 10h2.2" {...stroke} />
    </Icon>
  );
}

function MegaphoneIcon() {
  return (
    <Icon>
      <path d="M3 6.6v2.8a1 1 0 0 0 1 1h1.6L10.4 13V3L5.6 5.6H4a1 1 0 0 0-1 1z" {...stroke} />
      <path d="M12.4 6.2a2.6 2.6 0 0 1 0 3.6" {...stroke} />
    </Icon>
  );
}

function PlugIcon() {
  return (
    <Icon>
      <path d="M6.2 2.6v3.1M9.8 2.6v3.1" {...stroke} />
      <path d="M4.4 5.7h7.2v2.1a3.6 3.6 0 0 1-7.2 0V5.7z" {...stroke} />
      <path d="M8 11.4v2.2" {...stroke} />
    </Icon>
  );
}

function GridIcon() {
  return (
    <Icon>
      <rect x="2.6" y="2.6" width="4.6" height="4.6" rx="0.5" {...stroke} />
      <rect x="8.8" y="2.6" width="4.6" height="4.6" rx="0.5" {...stroke} />
      <rect x="2.6" y="8.8" width="4.6" height="4.6" rx="0.5" {...stroke} />
      <rect x="8.8" y="8.8" width="4.6" height="4.6" rx="0.5" {...stroke} />
    </Icon>
  );
}

function ClockIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8" r="5.5" {...stroke} />
      <path d="M8 4.8V8l2.2 1.6" {...stroke} />
    </Icon>
  );
}

function ReportIcon() {
  return (
    <Icon>
      <path d="M4 2.6h5.4L12.4 5.6V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1z" {...stroke} />
      <path d="M9.2 2.6v3.2h3.2" {...stroke} />
      <path d="M5.6 11.4V9.2M8 11.4V7.8M10.2 11.4v-1.6" {...stroke} />
    </Icon>
  );
}
