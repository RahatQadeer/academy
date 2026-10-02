import { Avatar } from "@/base/components/Avatar";
import { Input } from "@/base/components/Input";

export function StepIdentity({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  return (
    <div>
      <p
        className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--accent)" }}
      >
        Step 1
      </p>
      <h1 className="text-[26px] font-bold tracking-[-0.45px] text-pretty text-ink sm:text-[28px]">
        Confirm your account
      </h1>
      <p
        className="mt-1.5 max-w-[34rem] text-[14px] leading-relaxed text-pretty"
        style={{ color: "var(--text-secondary)" }}
      >
        Your Private Attaché identity is ready. Confirm it, then we&apos;ll personalize
        your learning and certificates.
      </p>

      <div
        className="mt-5 overflow-hidden rounded-[14px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(120deg, color-mix(in srgb, var(--accent-tint) 80%, white) 0%, var(--surface) 72%)",
          }}
        >
          <Avatar name={fullName || email || "Learner"} size={42} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ink">
              {fullName || "Your account"}
            </div>
            <p className="truncate text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Imported from Private Attaché
            </p>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <Input label="Full name" name="fullName" value={fullName} readOnly />
          <Input label="Email address" name="email" value={email} readOnly />
        </div>
      </div>
    </div>
  );
}
