type AcademyAuthPanelProps = {
  variant: "login" | "signup";
};

export function AcademyAuthPanel({ variant }: AcademyAuthPanelProps) {
  const login = variant === "login";

  return (
    <section
      className="hidden lg:flex flex-col justify-between px-12 py-10"
      style={
        login
          ? { background: "var(--ink)", color: "rgba(255,255,255,.65)" }
          : {
              background: "var(--surface-soft)",
              borderLeft: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }
      }
    >
      {login ? (
        <div>
          <span
            className="inline-flex items-center rounded-[4px] px-[9px] py-[3px] text-[12px] font-medium"
            style={{
              background: "var(--module-academy-bg)",
              color: "var(--module-academy-fg)",
            }}
          >
            Academy
          </span>
        </div>
      ) : (
        <div />
      )}

      {login ? <LoginAside /> : <SignupAside />}

      {login ? (
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,.45)" }}>
          Private Attaché™ Academy — one identity, one catalog.
        </p>
      ) : (
        <div />
      )}
    </section>
  );
}

function LoginAside() {
  return (
    <div className="max-w-[520px]">
      <h2 className="text-[32px] font-bold leading-[1.08] tracking-[-0.04em] text-white">
        Certification, specialty training, and short courses in one place.
      </h2>
      <p className="mt-4 max-w-[448px] text-[15px] leading-relaxed">
        Your Academy learner identity, your Whitby platform access, and your Partner
        account all live under one sign-in.
      </p>
      <div className="mt-8" style={{ borderTop: "1px solid rgba(255,255,255,.28)" }}>
        <AsideRow title="Certified Private Attaché credential" meta="3-year term" />
        <AsideRow title="Specialty Endorsements" meta="8 available" />
        <AsideRow title="Intelligent Coordination" meta="Free" last />
      </div>
    </div>
  );
}

function SignupAside() {
  return (
    <div className="max-w-[520px]">
      <p
        className="mb-4 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        What happens next
      </p>
      <div className="space-y-5">
        <NextStep
          n="1"
          title="One email, one account"
          detail="This email is your only Academy identity. Instructor and Admin access is granted on this same account — never by creating a second signup."
        />
        <NextStep
          n="2"
          title="Tell us what you're interested in"
          detail="Helps us recommend the right courses — never restricts access."
        />
        <NextStep
          n="3"
          title="Land in your unified Academy"
          detail="One catalog, every program, no separate environments."
        />
      </div>
    </div>
  );
}

function AsideRow({
  title,
  meta,
  last,
}: {
  title: string;
  meta: string;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-[18px]"
      style={{
        borderBottom: last ? undefined : "1px solid rgba(255,255,255,.28)",
      }}
    >
      <span className="text-[15px] font-medium text-white">{title}</span>
      <span className="shrink-0 text-[13px]" style={{ color: "rgba(255,255,255,.5)" }}>
        {meta}
      </span>
    </div>
  );
}

function NextStep({
  n,
  title,
  detail,
}: {
  n: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
        style={{
          border: n === "1" ? "1.5px solid var(--accent)" : "1.5px solid var(--border-strong)",
          color: n === "1" ? "var(--accent)" : "var(--text-tertiary)",
        }}
      >
        {n}
      </span>
      <div>
        <div className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>
          {title}
        </div>
        <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          {detail}
        </p>
      </div>
    </div>
  );
}
