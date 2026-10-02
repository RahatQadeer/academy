import Link from "next/link";

export function SuperAdminNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6">
      <h1 className="text-[22px] font-bold tracking-[-0.3px]">Page not found</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        This Super Admin screen does not exist yet.
      </p>
      <Link
        href="/super-admin"
        className="mt-6 text-[13.5px] font-medium no-underline"
        style={{ color: "var(--accent)" }}
      >
        ← Super Admin home
      </Link>
    </div>
  );
}
