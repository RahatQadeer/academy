# Academy Super Admin — notes

**Rule:** No separate table per feature. Prefer fields on existing models.

| Need | Where it lives | Not created |
|---|---|---|
| Super Admin role | `academy_memberships.role = 'super_admin'` | No `academy_super_admins` table |
| **Exactly one** active Super Admin | Enforced in `academy_grant_super_admin` (`00066`) | Multiple Admins / Instructors / Learners OK |
| Suspend / soft-delete users | `users.status` | No soft-delete table |
| Admin grant/revoke | RPCs on `academy_memberships` | — |
| Activity history | Shared `audit_log` | No `academy_audit_logs` table |
| Settings | Cookie settings; SA-only `identityProvider` | No settings table |
| Capabilities | `capabilityMatrix.ts` + `canPerform` | No permissions table / Permissions page |

Academy Super Admin ≠ platform `/super-admin` staff.

---

## Product rules

- **One Super Admin** for Academy (bootstrapped via SQL). App cannot create a second.
- **Many** Admins, Instructors, Learners.
- One active Academy role per email (exclusive).
- **Super Admin focuses on people:** Users, Instructors, Admins, Learners, Activity log.
- **Academy Admins** own Programs, Question bank, Publish approvals, Certificates, and Settings. Super Admin is redirected away from those routes.

---

## Super Admin UI

| Path | Purpose |
|---|---|
| `/academy/admin` | Dashboard (people overview) |
| `/academy/admin/users` | Paginated directory of all users + search; suspend / soft-delete |
| `/academy/admin/instructors` | Grant / revoke Instructor; profiles |
| `/academy/admin/instructors/[userId]` | Instructor profile — activity metrics + assignments |
| `/academy/admin/admins` | Grant / revoke Academy Admin; invite new emails (24h link). Super Admin only |
| `/academy/admin/admins/[userId]` | Admin profile — activity metrics |
| `/academy/admin/enrollments` | Learners directory |
| `/academy/admin/audit` | Activity log (who changed users, roles, and settings) |

**Not in Super Admin nav** (Academy Admin surface): Programs, Question bank, Publish approvals, Certificates, Settings.

**Removed (extra):** Roles page, Permissions page.

---

## Migrations

`00063` (enum) → `00063b` (helpers) → `00064` → `00065` → **`00066` (single Super Admin)** → `00067` (Admin invite).

Apply each in a separate transaction.
