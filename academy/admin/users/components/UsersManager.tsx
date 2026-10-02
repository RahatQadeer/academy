"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import { listManagedUsersAction } from "../actions";
import type { ManagedAcademyRole, ManagedUser, ManagedUserStatus } from "../types";
import { USER_PAGE_SIZE } from "../types";
import { ManagedUserRow } from "./ManagedUserRow";

const STATUS_FILTERS: { id: ManagedUserStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
  { id: "deleted", label: "Deleted" },
];

/** Super Admin is singular — not offered as a filter. Roles live in one select. */
const ROLE_OPTIONS: { id: ManagedAcademyRole | "all"; label: string }[] = [
  { id: "all", label: "All roles" },
  { id: "admin", label: "Admin" },
  { id: "instructor", label: "Instructor" },
  { id: "learner", label: "Learner" },
];

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16.5 16.5L21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UsersManager() {
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [status, setStatus] = useState<ManagedUserStatus | "all">("all");
  const [role, setRole] = useState<ManagedAcademyRole | "all">("all");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const requestId = useRef(0);

  function load(next?: {
    page?: number;
    query?: string;
    status?: ManagedUserStatus | "all";
    role?: ManagedAcademyRole | "all";
  }) {
    const nextPage = next?.page ?? page;
    const nextQuery = next?.query ?? query;
    const nextStatus = next?.status ?? status;
    const nextRole = next?.role ?? role;
    const id = ++requestId.current;

    startTransition(async () => {
      setError(null);
      const result = await listManagedUsersAction({
        page: nextPage,
        query: nextQuery,
        status: nextStatus,
        role: nextRole,
      });
      // Ignore stale responses when filters change quickly.
      if (id !== requestId.current) return;

      if (!result.ok) {
        setUsers([]);
        setError(result.message || "Users could not be loaded.");
        setLoaded(true);
        return;
      }
      setUsers(result.data.users);
      setTotal(result.data.total);
      setTotalPages(result.data.totalPages);
      setPage(result.data.page);
      setLoaded(true);
    });
  }

  useEffect(() => {
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySearch() {
    const q = draftQuery.trim();
    setQuery(q);
    setPage(1);
    load({ page: 1, query: q });
  }

  function changeStatus(next: ManagedUserStatus | "all") {
    if (next === status) return;
    setStatus(next);
    setPage(1);
    load({ page: 1, status: next });
  }

  function changeRole(next: ManagedAcademyRole | "all") {
    if (next === role) return;
    setRole(next);
    setPage(1);
    load({ page: 1, role: next });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <h1
          className="text-[28px] font-semibold tracking-[-0.5px]"
          style={{ color: "var(--ink)" }}
        >
          Users
        </h1>
        <p
          className="pb-1 text-[13px] font-medium tabular-nums"
          style={{ color: "var(--text-tertiary)" }}
        >
          {loaded ? `${total.toLocaleString()}` : "…"}
        </p>
      </header>

      <section
        className="overflow-hidden rounded-[14px] bg-white shadow-[0_1px_2px_rgba(55,53,47,0.04)]"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:gap-3 sm:px-5"
          style={{ borderColor: "var(--border)" }}
        >
          <form
            className="relative min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
          >
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center"
              style={{ color: "var(--text-secondary)" }}
            >
              <SearchIcon />
            </span>
            <input
              name="q"
              value={draftQuery}
              autoComplete="off"
              placeholder="Search by name or email"
              onChange={(event) => setDraftQuery(event.target.value)}
              className="w-full rounded-[10px] border bg-[var(--surface-soft)] py-2.5 pl-11 pr-3 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_3px_var(--accent-tint)]"
              style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
            />
          </form>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="secondary" onClick={applySearch}>
              Search
            </Button>
            {query ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraftQuery("");
                  setQuery("");
                  setPage(1);
                  load({ page: 1, query: "" });
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">
            {STATUS_FILTERS.map((item) => {
              const selected = status === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => changeStatus(item.id)}
                  className="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                  style={{
                    background: selected ? "var(--ink)" : "var(--surface-soft)",
                    color: selected ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <label className="relative inline-flex shrink-0" aria-label="Role">
            <select
              value={role}
              onChange={(event) =>
                changeRole(event.target.value as ManagedAcademyRole | "all")
              }
              className="appearance-none cursor-pointer rounded-[10px] border bg-[var(--surface-soft)] py-2 pl-3.5 pr-10 text-[13.5px] font-medium outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_3px_var(--accent-tint)]"
              style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
            >
              {ROLE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-secondary)" }}
              aria-hidden
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 4.5 6 8l3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </label>
        </div>
      </section>

      {error ? (
        <p
          className="rounded-[10px] px-4 py-3 text-[13.5px]"
          style={{
            background: "var(--warning-bg)",
            color: "var(--warning-fg, #7a5a2e)",
            border: "1px solid var(--warning-border, #f2e2ca)",
          }}
        >
          {error}
        </p>
      ) : null}

      <div className={pending && loaded ? "opacity-60 transition-opacity duration-150" : undefined}>
        {!loaded && pending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[76px] animate-pulse rounded-[14px]"
                style={{ background: "var(--surface-soft)" }}
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div
            className="rounded-[14px] bg-white px-6 py-14 text-center"
            style={{ border: "1px solid var(--border)" }}
          >
            <p className="text-[16px] font-medium tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
              No users found
            </p>
            <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
              Try another search or clear filters.
            </p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {users.map((user) => (
              <li key={user.userId}>
                <ManagedUserRow user={user} onChanged={() => load()} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {loaded && totalPages > 1 ? (
        <div
          className="overflow-hidden rounded-[12px] bg-surface px-4 py-3 sm:px-5"
          style={{ border: "1px solid var(--border)" }}
        >
          <PaginationBar
            page={page}
            pageCount={totalPages}
            total={total}
            rangeStart={(page - 1) * USER_PAGE_SIZE + 1}
            rangeEnd={Math.min(page * USER_PAGE_SIZE, total)}
            itemLabel="users"
            label="Users pages"
            onPageChange={(next) => {
              setPage(next);
              load({ page: next });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
