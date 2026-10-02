import Link from "next/link";
import { PartnerCheckEmailPanel } from "@/partner-center/auth/components/PartnerCheckEmailPanel";

function EnvelopeIcon() {
  return (
    <span
      className="inline-flex h-11 w-11 items-center justify-center rounded-full"
      style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    </span>
  );
}

export default function PartnerCheckEmailPage({ email }: { email?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <div
        className="w-full max-w-[400px] rounded-card bg-surface px-8 py-9 text-center shadow-card"
        style={{ border: "1px solid var(--border)" }}
      >
        <EnvelopeIcon />
        <h1 className="mt-4 text-[20px] font-bold tracking-[-0.3px]">
          Check your email
        </h1>
        <div className="mt-2 text-left">
          <PartnerCheckEmailPanel email={email} />
        </div>
        <p className="mt-5 text-center text-[13.5px]">
          <Link href="/partner-center/signin" className="font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

