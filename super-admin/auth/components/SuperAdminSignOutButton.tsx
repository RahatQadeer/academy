"use client";

/** Sign out Super Admin staff cookie and return to staff sign-in. */
export function SuperAdminSignOutButton({
  className,
  label = "Sign out",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form action="/api/super-admin/logout" method="post">
      <button
        type="submit"
        className={className}
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </button>
    </form>
  );
}
