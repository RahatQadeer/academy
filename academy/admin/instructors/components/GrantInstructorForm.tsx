"use client";

import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { revokeAcademyLearnerRoleAction } from "../actions";
import { searchUsersForInstructorGrantAction } from "../actions";
import type { InstructorGrantCandidate } from "../types";
import { USER_SEARCH_MIN } from "../types";
import { InstructorRoleButton } from "./InstructorRoleButton";

function statusLabel(status: InstructorGrantCandidate["instructorStatus"]) {
  if (status === "active") return "Active Instructor";
  if (status === "suspended") return "Suspended Instructor";
  return "Not an Instructor";
}

function conflictLabel(role: NonNullable<InstructorGrantCandidate["conflictRole"]>) {
  if (role === "learner") return "Active Learner — remove Learner before granting Instructor";
  if (role === "super_admin") return "Active Super Admin — revoke Super Admin before granting Instructor";
  return "Active Academy Admin — revoke Admin before granting Instructor";
}

export function GrantInstructorForm() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<InstructorGrantCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [revokePendingId, setRevokePendingId] = useState<string | null>(null);

  function search() {
    startTransition(async () => {
      setError(null);
      const result = await searchUsersForInstructorGrantAction(query);
      if (!result.ok) {
        setUsers(null);
        setError(result.message || "Users could not be searched.");
        return;
      }
      setUsers(result.data.users);
    });
  }

  function removeLearner(userId: string) {
    setRevokePendingId(userId);
    startTransition(async () => {
      setError(null);
      const result = await revokeAcademyLearnerRoleAction(userId);
      setRevokePendingId(null);
      if (!result.ok) {
        setError(result.message || "The Learner role could not be removed.");
        return;
      }
      search();
    });
  }

  return (
    <section
      className="rounded-[10px] bg-surface p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <h2 className="text-[13.5px] font-medium">Grant Instructor</h2>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Search an existing Private Attaché user. One email can hold only one Academy role — remove
        Learner or Admin first, then grant Instructor, or use a different email. This does not
        assign a program.
      </p>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            label="Find a user"
            name="q"
            value={query}
            autoComplete="off"
            placeholder="Name or email"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending || query.trim().length < USER_SEARCH_MIN}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>
      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
      {users && users.length === 0 ? (
        <p className="mt-4 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          No matching users.
        </p>
      ) : null}
      {users && users.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {users.map((user) => (
            <li
              key={user.userId}
              className="flex flex-col gap-3 rounded-[8px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{user.displayName}</p>
                {user.email ? (
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {user.email}
                  </p>
                ) : null}
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {user.conflictRole
                    ? conflictLabel(user.conflictRole)
                    : statusLabel(user.instructorStatus)}
                </p>
              </div>
              {user.instructorStatus === "active" ? (
                <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  Already an Instructor
                </p>
              ) : user.conflictRole === "learner" ? (
                <Button
                  variant="secondary"
                  disabled={pending || revokePendingId === user.userId}
                  onClick={() => removeLearner(user.userId)}
                >
                  {revokePendingId === user.userId ? "Removing…" : "Remove Learner role"}
                </Button>
              ) : user.conflictRole === "admin" || user.conflictRole === "super_admin" ? (
                <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  {user.conflictRole === "super_admin"
                    ? "Revoke Super Admin before granting Instructor"
                    : "Active Admin — use a different account"}
                </p>
              ) : (
                <InstructorRoleButton
                  userId={user.userId}
                  action={user.instructorStatus === "suspended" ? "reactivate" : "grant"}
                  onComplete={search}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
