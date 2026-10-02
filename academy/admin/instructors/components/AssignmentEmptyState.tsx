export function AssignmentEmptyState({
  kind,
}: {
  kind: "instructors" | "suspended" | "assignments" | "programs" | "all_assigned";
}) {
  const title =
    kind === "instructors"
      ? "No active Instructors"
      : kind === "suspended"
        ? "No suspended Instructors"
        : kind === "programs"
          ? "No programs"
          : kind === "all_assigned"
            ? "All programs assigned"
            : "No program assignments";
  const body =
    kind === "instructors"
      ? "Search for an existing user above to grant the Instructor role. Granting the role does not assign a program."
      : kind === "suspended"
        ? "Revoked Instructors appear here. Their program assignments are kept until you assign or revoke them separately."
        : kind === "programs"
          ? "There are no programs available to assign."
          : kind === "all_assigned"
            ? "This Instructor is already assigned to every program in this list."
            : "This Instructor is not assigned to any program.";

  return (
    <div
      className="rounded-[10px] bg-surface px-6 py-8 text-center"
      style={{ border: "1px solid var(--border)" }}
    >
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {body}
      </p>
    </div>
  );
}
