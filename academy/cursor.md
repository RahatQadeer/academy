# Cursor context — Academy + LMS

Owner: Rahat  
Branch off `base`: `rahat/academy-lms`  
Work in: `/academy` (`page.tsx`, `nav.ts`, then your own screens)  
Routes: `/academy` — do not put product screens in `/app` or `/base`  
Tables: `academy_*` (one schema for learner Academy and instructor LMS)

## Brand

Private Attaché Academy, or Academy. Not Institute, not WinstonOS. Intelligent Coordination is the free Whitby-related course — never label it "Whitby Product Training". Certified Private Attaché stays platform-neutral.

## Auth and roles

No public instructor sign-up. Every new Academy identity defaults to Learner. Instructor and Academy Admin are assigned by Academy Super Admins (Admin grant) or existing Admin flows for instructors. **Academy Super Admin** is a fourth exclusive role on `academy_memberships.role` — not a new table, and distinct from platform `/super-admin` staff.

**TEMPORARY (remove later):** Brent’s course-builder helper login is capped at 10 courses via `ACADEMY_TEMP_INSTRUCTOR_EMAILS` / `ACADEMY_TEMP_INSTRUCTOR_COURSE_CAP` and `academy/lib/tempInstructorQuota.ts`. Re-provision with `academy/scripts/provision-temp-instructor.mjs`. Delete the account + env vars + call sites when finished.

**One email = one Academy role.** Learner, Instructor, Admin, and Super Admin never stack on the same account. To change role, suspend/remove the current role first, then grant the new one. There is no Learner/Admin switcher.

Reuse the shared identity. If the person already has a Private Attaché account, do not ask them to re-enter it.

**Super Admin docs:** see `academy/SUPER-ADMIN.md` (one Super Admin; Users directory + Activity log; reuse of `users` / `audit_log` / memberships — no Roles/Permissions pages or feature tables).

## Nav (learner)

Dashboard, My Learning, Explore, Certificates & Credentials, Resources.

LMS / admin is a surface on the same catalog, not a second product. Course builder: Programs → Modules → Lessons → Resources → Assessments → Preview → Publish.

## Instructor publishing (corrected)

An Instructor can create and edit content in programs assigned via `academy_instructor_assignments`, but cannot set status to `published`. They submit `academy_publish_requests`. After Admin approval, either the Instructor or the Admin may complete the publish.

Do not put Enrollments & Commission, Payouts, or Stripe into the instructor experience.

## Catalog

Certified Private Attaché, Professional Practice Accelerator, Specialty Endorsements (CPA prerequisite), Intelligent Coordination, additional free and paid courses.

CPA credential term is 3 years. Training Workspace: restricted Whitby workspace, 90-day expiry — confirm the hand-off with Sabahat (`academy_training_workspaces.workspace_id` → base `workspaces`).

Emit a qualifying-action event on paid course enrollment for Zara's partner attribution. Default commissionable conversion is a paid enrollment; free enrollment is tracked but not commissionable.

## Design

Academy purple token for both learner and authoring surfaces. Import `/base/components`. Read `docs/design-system.md`. Whitby may assist in the course player but must never access graded content or the question bank.
