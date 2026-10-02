# Private Attaché Ecosystem — Database Schema
### For direct DB setup (all schemas created up front, then each dev works within their own tables)

**Stack:** Postgres via one shared Supabase project (no per-module Supabase
projects). Next.js (App Router) on Vercel is the one application consuming
this schema across all four module route groups. Supabase Auth backs the
`users` table and the shared login flow; Supabase Storage backs the
`documents` table's `file_url` and Academy's video/attachment assets, with
signed URLs for anything gated by `visibility` or entitlement. Row-level
security policies, written alongside each table's migration, are the
enforcement mechanism for the Internal/Client Visible/Restricted model and
for workspace isolation — not an afterthought layered on later. Ship the
schema below as versioned Supabase migrations committed to the `base`
branch so every dev runs `supabase db push` against the same project
instead of configuring their own local database.

This document lists every table, its owner, and its fields, organized by
schema. Base is shared and owned by no single module. Each module schema
is prefixed and owned by the person named. Foreign keys always point at
the base tables for identity, contacts, companies, and documents — never
duplicated per module.

Corrections applied per latest direction:
- **Commission rate is the same across Academy, Platform, and Enterprise
  by default** — the source material only gives one concrete figure (15%)
  and frames every other number as an illustrative example, not a mandated
  per-program split. A single default rate is used for all three, with
  partner-specific and admin overrides still fully supported per-partner
  where the business later decides to differentiate.
- **Attribution window is 90 days for everyone by default**, except
  **Enterprise Opportunities, which use 180 days** — this is the one
  distinction the source material actually mandates explicitly (SRS
  Section 17.6.9 / Partner Center Admin Configuration sheet). Nothing else
  varies unless a later document says otherwise.
- **Instructor publishing flow corrected:** an Instructor can create and
  edit course content within programs assigned to them, but cannot publish
  directly. They submit for approval; once an Admin approves, either the
  Instructor or the Admin can publish. Reflected in `academy_publish_requests`
  below.

---

## BASE SCHEMA (shared — no module duplicates these)

### `users`
| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| email | text, unique | stored trimmed + lowercase; unique also on `lower(btrim(email))` |
| password_hash | text, nullable | null if OAuth-only |
| oauth_provider | text, nullable | `google`, etc. |
| oauth_id | text, nullable | |
| full_name | text | |
| preferred_name | text, nullable | |
| salutation | text, nullable | Dr., Mr., Mrs., Ms., Sir, Dame, etc. |
| phone | text, nullable | |
| avatar_url | text, nullable | |
| timezone | text | |
| status | enum | active, suspended, deleted |
| last_login_at | timestamp, nullable | |
| created_at / updated_at | timestamp | |

### `super_admins`
| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| email | text, unique | stored trimmed + lowercase |
| password_hash | text | bcrypt via pgcrypto (`crypt` / `gen_salt('bf', 12)`) |
| created_at / updated_at | timestamp | |

Platform Super Admin credentials live **only** in this table — not Supabase Auth. Add/update with SQL: `select public.upsert_super_admin('email@example.com', 'password');` (password ≥ 12 chars). Sign-in is `/super-admin/signin` (HMAC staff cookie: dedicated `SUPER_ADMIN_SESSION_SECRET`, 2h TTL, SameSite=Lax). `verify_super_admin` + login attempt RPCs are service-role only. Lockout: 5 failures / 15 minutes per IP+email (`super_admin_login_attempts`).

### `super_admin_login_attempts`
id, attempt_key, success, created_at — rate-limit / audit log for staff sign-in. Service-role only.

### `workspaces`
| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| name | text | |
| url_slug | text, unique | |
| logo_url | text, nullable | |
| team_size | text, nullable | |
| timezone | text, nullable | |
| owner_user_id | fk → users.id | |
| created_at / updated_at | timestamp | |

### `workspace_members`
| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| workspace_id | fk → workspaces.id | |
| user_id | fk → users.id | |
| role | enum | owner, admin, team_lead, coordinator, billing, viewer |
| status | enum | active, invited, suspended |
| created_at | timestamp | |

### `entitlements`
| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| user_id | fk → users.id | |
| product | enum | whitbyos, client_portal, academy, partner_center |
| workspace_id | fk → workspaces.id, nullable | null for academy/partner (not workspace-scoped) |
| status | enum | active, trial, expired, revoked |
| is_default_landing | boolean | |
| created_at / updated_at | timestamp | |

### `invitations`
One generic table reused by team invites, client member/authorized-user invites, and partner-application approvals.

| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| token | text, unique | |
| inviter_user_id | fk → users.id | |
| invitee_email | text | |
| invitee_name | text, nullable | |
| context_type | enum | team_member, client_member, client_authorized_user, partner_team |
| context_id | uuid | polymorphic — workspace_id, client_id, or partner_profile_id depending on context_type |
| role_or_relationship | text | |
| status | enum | pending, accepted, expired, revoked |
| sent_at / accepted_at / expires_at | timestamp | |
| created_by | fk → users.id | |

### `contacts`
Canonical person record — reused by WhitbyOS (as Client members, Provider individuals) and Partner Center (as Partner team members).

| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| first_name / last_name | text | |
| preferred_name | text, nullable | |
| salutation | text, nullable | |
| email | text, nullable | |
| phone | text, nullable | |
| title_role | text, nullable | |
| source | text, nullable | how this record was created |
| enrichment_data | jsonb, nullable | website/social/profile links etc. |
| created_by_workspace_id | fk → workspaces.id, nullable | which workspace first created this record, for scoping |
| created_at / updated_at | timestamp | |

### `contact_roles`
Join table capturing every relationship-role label a Contact can carry, per SRS Section 5.5 and 13.14.

| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| contact_id | fk → contacts.id | |
| related_type | enum | client, company, request, workstream, partner_profile |
| related_id | uuid | |
| role_label | enum | primary_member, additional_member, authorized_user, dependent, primary_contact, billing_contact, decision_maker, authorized_representative, provider, partner_company_admin, partner_referral_contact, partner_billing_contact, partner_authorized_signer, partner_read_only |
| workspace_id | fk → workspaces.id, nullable | |
| portal_access | boolean | |
| scope | jsonb, nullable | selected requests/functions this role is limited to |
| created_at | timestamp | |

### `companies`
Canonical organization record — reused by WhitbyOS (Companies, Providers) and Partner Center (Partner Company).

| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| name | text | |
| website | text, nullable | |
| industry_type | text, nullable | |
| addresses | jsonb, nullable | supports multiple locations |
| markets | jsonb, nullable | array of region/country/state/city |
| audience_served | text, nullable | |
| enrichment_data | jsonb, nullable | |
| created_by_workspace_id | fk → workspaces.id, nullable | |
| created_at / updated_at | timestamp | |

### `company_contacts`
| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| company_id | fk → companies.id | |
| contact_id | fk → contacts.id | |
| title_function | text, nullable | |
| is_primary | boolean | |

### `documents`
Shared Documents model — used by WhitbyOS, Client Portal, and Partner Center.

| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| title | text | |
| file_url | text | |
| context_type | enum | client, request, workstream, partner_profile, company, contact |
| context_id | uuid | |
| visibility | enum | internal, client_visible, restricted |
| status | enum | current, action_needed, completed, archived |
| version | integer | |
| effective_date | date, nullable | |
| signed_date | date, nullable | |
| superseded_by_document_id | fk → documents.id, nullable | |
| uploaded_by_user_id | fk → users.id, nullable | |
| shared_by_user_id | fk → users.id, nullable | |
| created_at / updated_at | timestamp | |

Partner Program / expiration / agreement extras live on `partner_document_meta` (not on this shared table). Labels stay organizational only (§14.4).

### `document_labels`
| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| document_id | fk → documents.id | |
| label_text | text | |
| created_by_user_id | fk → users.id | |

### `audit_log`
| Field | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| actor_user_id | fk → users.id | |
| entity_type | text | |
| entity_id | uuid | |
| action | text | |
| previous_value | jsonb, nullable | |
| new_value | jsonb, nullable | |
| reason | text, nullable | |
| created_at | timestamp | |

### `taxonomy_categories` / `taxonomy_subcategories`
Shared Category/Subcategory reference (SRS Section 10), used by WhitbyOS Providers and Partner Center capability tagging.

| Field | Type | Notes |
|---|---|---|
| id | text, pk | e.g. CAT-0010 |
| slug | text | |
| name | text | |
| sort_order | integer | |
| active | boolean | |
| default_sensitivity | enum | normal, sensitive |

`taxonomy_subcategories` mirrors this with `parent_category_id` fk.

---

## WHITBYOS SCHEMA — owner: Sabahat (prefix `whitbyos_`)

### `whitbyos_clients`
id, workspace_id (fk), name, client_type (individual/family/company/organization), status, owner_user_id (fk users), primary_contact_id (fk contacts), preferences (jsonb), created_at, updated_at

### `whitbyos_client_members`
id, client_id (fk), contact_id (fk contacts), role (mirrors contact_roles enum), portal_access (bool), max_additional_members, max_authorized_users, created_at

### `whitbyos_requests`
id, client_id (fk), workspace_id (fk), title, desired_outcome, definition_of_done, status, priority, owner_user_id (fk), start_date, target_date, waiting_on, next_action, visibility (private_to_requestor/selected_people/client_account), created_at, updated_at, closed_at

### `whitbyos_request_participants`
id, request_id (fk), participant_type (team_member/contact/company/provider), participant_id, role, created_at

### `whitbyos_workplans`
id, request_id (fk, 1:1), name, desired_outcome, definition_of_done, owner_user_id, status (draft/active/paused/complete), start_date, target_date, current_next_action, version, created_at, updated_at

### `whitbyos_workplan_versions`
id, workplan_id (fk), version_number, snapshot (jsonb), change_reason, created_by_user_id, created_at

### `whitbyos_workstreams`
id, workplan_id (fk), name, purpose, priority, owner_user_id, status, target_date, next_action, progress, sort_order, created_at, updated_at

### `whitbyos_workstream_dependencies`
id, workstream_id (fk), depends_on_workstream_id (fk, nullable), depends_on_task_id (fk, nullable), description

### `whitbyos_tasks`
id, workspace_id (fk), request_id (fk, nullable), workstream_id (fk, nullable), title, owner_user_id, status, priority, due_date, waiting_state, dependency_task_id (fk, nullable), next_action, completion_evidence, visibility, created_at, updated_at

### `whitbyos_worksheets`
id, workstream_id (fk), title, type, data (jsonb), created_from (blank/template/duplicate/whitby), created_at, updated_at

### `whitbyos_worksheet_rows`
id, worksheet_id (fk), row_data (jsonb), linked_task_id (fk, nullable), linked_provider_id (fk, nullable), linked_decision_id (fk, nullable), created_at

### `whitbyos_forms`
id, workspace_id (fk), title, is_template (bool), fields (jsonb schema), embed_enabled (bool), created_at, updated_at

### `whitbyos_form_submissions`
id, form_id (fk), request_id (fk, nullable), client_id (fk, nullable), submitted_by_contact_id (fk, nullable), status, responses (jsonb), submitted_at

### `whitbyos_checklists`
id, workstream_id (fk), title, items (jsonb), source_playbook_id (fk, nullable), created_at

### `whitbyos_playbooks`
id, workspace_id (fk), name, category, contents (jsonb), version, shared_level (my/shared/org), created_from_workplan_id (fk, nullable), created_at, updated_at

### `whitbyos_providers`
id, contact_id (fk, nullable), company_id (fk, nullable), readiness (prospect/screened/qualified/preferred/inactive/excluded), category_id (fk taxonomy), subcategory_id (fk taxonomy), specialty_capability (text), evidence_source, last_verified_at, outreach_status, next_follow_up_date, created_at, updated_at

### `whitbyos_provider_options`
id, request_id (fk), provider_id (fk), status (option_for_review/shortlisted/selected/confirmed), client_visible_content (jsonb), created_at

*(Provider documents/agreements use base `documents` with `context_type='company'` or `'contact'`.)*

### `whitbyos_messages` / `whitbyos_message_participants`
- `whitbyos_messages`: id, workspace_id, thread_id, request_id (fk, nullable), client_id (fk, nullable), sender_type (user/contact), sender_id, body, source (native/gmail/outlook), external_message_id, created_at
- `whitbyos_message_participants`: id, thread_id, participant_type (user/contact), participant_id, history_visibility (full/from_added), added_by_user_id, added_at, removed_at, locked (bool — sensitive conversation)

### `whitbyos_communications`
id, workspace_id, request_id (fk, nullable), client_id (fk, nullable), type (call/meeting/text/whatsapp/other), summary, logged_by_user_id, occurred_at

### `whitbyos_calendar_events`
id, workspace_id, external_calendar (google/outlook), external_event_id, title, start_at, end_at, linked_client_id (fk, nullable), linked_request_id (fk, nullable), linked_contact_id (fk, nullable), client_visible (bool), created_at

### `whitbyos_notes`
id, request_id (fk), type (risk/decision_needed/approval/general), body, visibility, created_by_user_id, created_at

### `whitbyos_considerations`
id, workplan_id (fk), workstream_id (fk, nullable), type (missing_info/dependency_conflict/stale_info/risk_backup_gap/calendar_conflict/requirement_prompt/next_action), body, source_reference, status (open/dismissed/resolved), converted_to_task_id (fk, nullable), created_at, resolved_at

### `whitbyos_decisions`
id, request_id (fk), workstream_id (fk, nullable), title, options (jsonb), recommendation, decision_maker_contact_id (fk, nullable), approver_contact_id (fk, nullable), due_date, amount_threshold, status, result, created_at

### `whitbyos_risks`
id, workstream_id (fk), risk, impact, mitigation, backup_plan, trigger, status, created_at

### `whitbyos_updates`
id, request_id (fk, nullable — null for Plans & Updates), client_id (fk), type (progress_update/plans_update), body, status (draft/review/published), published_at, created_by_user_id, created_at

### `whitbyos_timeline_events`
id, request_id (fk), event_type, description, source_reference, client_visible (bool), created_at

### `whitbyos_knowledge`
id, workspace_id, title, type (guide/sop/policy), body_or_file_url, category, status (draft/review/published), created_at, updated_at

### `whitbyos_integrations`
id, workspace_id, provider (gmail/outlook_mail/google_calendar/outlook_calendar/stripe/quickbooks), status (connected/needs_attention/disconnected), connected_account, scopes, last_sync_at, error_state, created_at

*(Insights and Reports nav are computed views over `whitbyos_considerations` and other tables above — no dedicated table needed beyond an optional `whitbyos_insight_saves` for the "Saved" filter: id, consideration_id, saved_by_user_id, created_at.)*

---

## CLIENT PORTAL SCHEMA — owner: Rohail (prefix `client_portal_`)

Deliberately small — the portal reads/writes `whitbyos_*` tables directly through the permission layer for everything else (Requests, Documents, Forms, Messages, Updates, Calendar).

### `client_portal_access_requests`
id, client_id (fk whitbyos_clients), requested_by_contact_id (fk contacts), person_name, person_email, relationship, requested_role, reason, status (pending/approved_as_requested/approved_edited/declined), reviewed_by_user_id (fk, nullable), reviewed_at, created_at

### `client_portal_notification_prefs`
id, contact_id (fk), event_type (new_message/progress_update/action_needed/form_requested/document_shared/approval_requested/calendar_change/request_status_change/invoice_payment_event), channel, enabled (bool)

---

## ACADEMY + LMS SCHEMA — owner: Rahat (prefix `academy_`, one schema for both surfaces)

### `academy_memberships`
id, user_id (fk base users), role (**learner / instructor / admin / super_admin** — `admin` is Academy Admin; `super_admin` is Academy Super Admin and inherits Admin privileges; distinct from platform `super_admins` staff table), status (active/suspended), granted_by_user_id (fk, nullable), granted_at, created_at, updated_at. unique(user_id, role). **One active role per user_id** — roles do not stack on the same email; suspend the current role before granting another. Priority when resolving exclusivity: super_admin > admin > instructor > learner. RPCs `academy_grant_admin` / `academy_revoke_admin` and `academy_grant_super_admin` / `academy_revoke_super_admin` require an active Super Admin (`is_academy_super_admin()`). **At most one active Academy Super Admin** is allowed (`academy_single_super_admin_required`); bootstrap/change the sole Super Admin via service-role SQL. Super Admin cannot revoke their own role or suspend the last (only) Super Admin; Admin grant also blocks self-grant. RLS: Academy Admins (including Super Admin) may write **learner/instructor** memberships only; **admin** and **super_admin** membership rows are writable only via those security-definer RPCs (never direct client insert/update/delete). SQL helper `is_academy_admin()` returns true for Admin **or** Super Admin so catalog RLS policies stay shared.

### `academy_learner_profiles`
id key = user_id (fk base users, pk). onboarding_completed_at (nullable), interest_ids (text[] — Academy onboarding interest ids from §4.12), created_at, updated_at. Source of truth for learner onboarding completion across environments; cookie remains a cache only.

### `academy_programs`
id, name, type (short_course/course/certification_program/endorsement_program), access (free/standard_plus/professional_plus/teams_plus/purchased/organization_assigned), recognition (none/certificate_of_completion/professional_certification/specialty_endorsement), learning_path (whitby/business_and_practice/specialty/certification/organization_training), credential_validity (none/three_years — certificate term for awards from this program; default none; professional_certification / CPA-style programs backfill to three_years), category (course topic tags — 1–3 names, comma-separated; premade list in app constants; custom bank in Academy admin settings), prerequisite_program_id (fk self, nullable), price (nullable — free if null), status (draft/pending_approval/published), description, created_by_user_id (fk), created_at, updated_at, cover_image_url (nullable — storage path or public URL for learner catalog hero), unpublished_draft (jsonb, nullable — staged curriculum/metadata while status is published; learners keep reading live modules/lessons until Publish changes applies this), unpublished_draft_updated_at (nullable)

Course Type is independent of Access and Recognition. CPA is a `certification_program` with `professional_certification` recognition and typically `purchased` access. Specialty Endorsements are `endorsement_program` with `specialty_endorsement` recognition and are independently purchasable (no default CPA prerequisite). Certificate expiry is configured per program via `credential_validity` (Does not expire / 3 years), not hard-wired to credential type alone. Course tags reuse `category` (no separate tag tables). Premade vs custom distinction is admin Tags UI only.

### `academy_modules`
id, program_id (fk), title, sort_order

### `academy_lessons`
id, module_id (fk), title, type (video/reading/attachment/quiz/scenario/resource/assignment), content_url, content_body, content_summary, learning_objectives (text[]), video_url, sort_order

### `academy_quizzes`
id, lesson_id (fk), passing_score

### `academy_questions`
id, program_id (fk, nullable — set for bank-only custom questions), quiz_id (fk, nullable — null until the question is copied into a quiz), question_text, type (multiple_choice / true_false for graded quiz items; assignment / exercise / other for open prompts saved in the bank), options (jsonb), correct_answer, sort_order

Index `(quiz_id, type)`. Partial index `(program_id)` where `quiz_id is null`. RPC `academy_list_question_bank(scope, search, type, program_id, module_id, page, page_size, status)` returns paginated **course-organized** question-bank rows: **custom** bank-only questions (`quiz_id` null, `status=custom`, including every saved type), graded quiz items (MCQ / true-false / other), assignment briefs as **open answer**, and lesson `PROMPT:` exercises as **lesson exercise**, plus totals, summary counts (including `custom`), and course/module filter metadata. Academy Admins may delete custom questions; instructors may create and reuse them but cannot delete them.

### `academy_lesson_resources`
id, lesson_id (fk), title, resource_type, url, notes, sort_order, created_at

### `academy_assignments`
id, lesson_id (fk unique), brief, submission_instructions, rubric, estimated_minutes, created_at, updated_at

### `academy_assignment_submissions`
In-course lesson assignment work (separate from `academy_applied_work_submissions`, which is the CPA credential-stage applied-work record).

id, assignment_id (fk), lesson_id (fk), program_id (fk), enrollment_id (fk), user_id (fk), status (draft/submitted/graded/resubmission_required), body, file_storage_path, file_name, score, max_score, feedback, attempt_count, submitted_at, graded_at, graded_by_user_id (fk, nullable), created_at, updated_at. Unique (assignment_id, user_id).

Certificate eligibility: if a program has any `academy_assignments` rows, every required assignment must be **graded** before the credential can enter `credential_review` or be awarded. Pending review or resubmission required keeps the certificate locked.

### `academy_enrollments`
id, user_id (fk base users), program_id (fk), status (enrolled/in_progress/completed), progress_percent, entitlement_source (purchase/free/admin_assigned/prerequisite_met), enrolled_at, completed_at

### `academy_checkout_sessions`
Paid program checkout state before Stripe fulfillment creates an enrollment.

id, user_id (fk base users), program_id (fk), amount, currency (default `usd`), status (pending/paid/expired/failed/canceled), stripe_checkout_session_id (nullable), stripe_payment_intent_id (nullable), enrollment_id (fk nullable — set when paid), paid_at, expires_at, created_at, updated_at. One pending checkout per `(user_id, program_id)`.

RPC `academy_fulfill_checkout(checkout_id)` marks the session paid and inserts `academy_enrollments` with `entitlement_source = purchase` (idempotent).

### `academy_lesson_progress`
id, enrollment_id (fk), lesson_id (fk), status (locked/in_progress/completed), completed_at

### `academy_credentials`
id, user_id (fk), program_id (fk), type (cpa_credential/specialty_endorsement/certificate_of_completion), status (required_learning/applied_work/final_assessment/credential_review/awarded), awarded_at, expires_at (set on award when the program’s `credential_validity` is `three_years` — award date + 3 years; otherwise null), renewal_status (active / pending_renewal / awaiting_learner / under_review — synced with open renewal requests), certificate_requested_at (nullable — set when the learner clicks Request certificate), certificate_number (nullable text — exactly 7 digits; assigned on award; unique when set). Public verify uses `certificate_number` only; visual prefixes on the sheet (`PA-SE` / `PA-CC` / `PA-CPA`) are display-only — both `1234567` and `PA-SE-1234567` verify the same award. RPC `academy_next_certificate_number()` allocates the next free 7-digit value. RPC `academy_request_certificate(credential_id)` validates readiness and sets the timestamp. Admin award lives under Admin → Credentials (not Pending Approval, which is program publish).

### `academy_credential_renewal_requests`
Learner-initiated renewal workflow for timed certificates. id, credential_id (fk), learner_user_id (fk), status (pending_admin / awaiting_form / awaiting_payment / awaiting_form_and_payment / under_review / approved / denied / canceled), admin_path (approve_direct / request_info / require_payment / require_payment_and_form), admin_notes, decided_by_user_id, decided_at, form_required, form_status (none / pending / submitted / reviewed), form_submitted_at, payment_required, payment_amount (from `academy_programs.price`), payment_currency, payment_status (none / pending / paid / failed / canceled), stripe_checkout_session_id, paid_at, expires_at_snapshot, expires_at_after, learner_message, created_at, updated_at. Unique open request per credential. Learner UI: Certificates → awarded sheet → **Renew certificate** (`/academy/credentials/:id/renew`). Admin UI: Certificates → **Renewal requests**. Option 1 approves and extends `expires_at` by 3 years (same certificate_number). Option 2 builds dynamic questions (short / long / attachment). Option 3 charges the program fee via Stripe — payment-only auto-renews; payment + form returns to admin review. Webhook `academy_kind=credential_renewal` on `/api/academy/checkout/webhook`.

### `academy_credential_renewal_form_questions` / `academy_credential_renewal_form_answers`
Dynamic renewal intake. Questions: renewal_request_id, sort_order, prompt, response_type (short_answer / long_answer / attachment), required. Answers: question_id, answer_text, attachment_path / attachment_name (academy storage).

### `academy_admin_notifications`
In-app admin alerts (renewal requests). kind, title, body, href, credential_id, renewal_request_id, created_at, dismissed_at. Email via Resend when configured.

### `academy_credential_renewal_reminders`
Ledger for timed renewal notices. id, credential_id (fk academy_credentials, cascade), days_before (90 | 60 | 30), sent_at, channel (email/log), status (sent/recorded). Unique (credential_id, days_before). Daily cron `GET /api/academy/credential-renewal-reminders` (Bearer `ACADEMY_CRON_SECRET` or `CRON_SECRET`) sends or records reminders for awarded credentials whose `expires_at` falls on that window. Optional `RESEND_API_KEY` / `RESEND_FROM_EMAIL` for delivery; without Resend the row is still recorded as `recorded` so the window is not retried forever. Admin renew (Admin → Certificates → awarded credential → **Renew 3-year term**) extends `expires_at` by 3 years and deletes that credential’s reminder rows so windows can fire again.

### `academy_certificate_templates`
Optional admin-managed certificate templates (schema reserved). The live learner certificate uses the built-in `CompletionCertificateTemplate` after admin award on `academy_credentials`. Binding columns (`is_default`, `academy_programs.certificate_template_id`) remain for a future template UI; awarding does not require them.

id, name, description (nullable), design (jsonb — palette, fonts, title, body copy with `{{merge_fields}}`, organization/signer details, layout flags), background_image_path (nullable — `academy` bucket), signature_image_path (nullable), is_default (bool — at most one; enforced by partial unique index), status (draft/active/archived), created_by_user_id (fk, nullable), created_at, updated_at.

Binding: a certificate resolves to `academy_programs.certificate_template_id` (per-program override) if set, else the `is_default` template, else a built-in fallback design. Merge fields filled at render time: `{{learnerName}}`, `{{programName}}`, `{{credentialTitle}}`, `{{organizationName}}`, `{{issueDate}}`, `{{credentialId}}`, `{{completionDate}}`. RPC `academy_set_default_certificate_template(template_id)` atomically promotes one default. RLS: read for any entitled Academy user; insert/update/delete for Academy Admins.

`academy_programs` gains `certificate_template_id` (fk → academy_certificate_templates, nullable, on delete set null) — the per-program template override.

### `academy_instructor_assignments`
id, user_id (fk — must carry Instructor role), program_id (fk), permission_level (edit/create), module_ids (uuid[] — empty = full program; otherwise selected `academy_modules`), can_publish_without_approval (bool, default false — instructor may publish assigned program without admin approval), assigned_by_admin_user_id (fk), created_at

### `academy_publish_requests`
Reflects the corrected workflow: Instructor can create/edit but not publish directly.

id, program_id (fk), submitted_by_user_id (fk — the Instructor), status (pending/approved/rejected), reviewed_by_admin_user_id (fk, nullable), reviewed_at, notes, published_by_user_id (fk, nullable — either the Instructor after approval, or the Admin directly), published_at, created_at

### `academy_training_workspaces`
id, user_id (fk), workspace_id (fk base workspaces — the restricted WhitbyOS workspace created for this learner), program_id (fk — the CPA program), provisioned_at, expires_at (90 days from provisioning), status (active/expired), converted_to_paid_at (timestamp, nullable)

---

## PARTNER CENTER SCHEMA — owner: Zara (prefix `partner_`)

### `partner_profiles`
id, company_id (fk base companies), primary_contact_id (fk base contacts), status (applied/under_review/approved/active/declined), partner_type, application_data (jsonb), agreement_status, agreement_document_id (fk base documents, nullable), tax_profile_status, payment_setup_status, payout_eligibility (eligible/needs_tax_setup/needs_payment_setup/on_hold), stripe_connect_account_id (text, nullable, unique when set — Stripe Express `acct_…` reference only), preferred_payout_method (stripe_connect/quickbooks/ach/check, nullable — §17.13.6), created_at, updated_at

### `partner_stripe_webhook_events`
id (Stripe event id, text PK), processed_at — idempotency store for Connect webhooks (§17.15.3). Service-role only (RLS on, no anon/authenticated policies).

### `partner_team_members`
id, partner_profile_id (fk), contact_id (fk base contacts), function (company_admin/referral_contact/billing_payment_contact/authorized_signer/read_only), access_level, created_at. **unique(partner_profile_id, contact_id)** — one membership per contact per partner profile (replay-safe team invite accept).

### `partner_programs`
id, partner_profile_id (fk), program (academy/platform/enterprise), active (bool), effective_start, effective_end

### `partner_commission_rules`
id, partner_profile_id (fk, nullable — null means this is the global default rule), program (academy/platform/enterprise), rate_type (percentage/flat), rate_value (**default 15% across all three programs unless a specific partner override exists**), earning_basis, eligible_period, attribution_window_days (**default 90 for Academy and Platform; 180 for Enterprise; admin-configurable custom days allowed**), eligible_revenue_rules (jsonb — `new_customer_period_days`, `exclude[]`, `refund_rule`, optional `components`), payment_terms (text — legacy "Net 30" or JSON `{display,netDays,holdDays,cadence,minPayoutDollars}`), effective_start, effective_end, created_at

### `partner_links_codes`
id, partner_profile_id (fk), code (unique), type (referral_link/access_code/campaign_event), cookie_life_days, created_at

### `partner_referrals`
id, partner_profile_id (fk), referral_code_id (fk), referred_user_id (fk base users, nullable until account created), referred_contact_id (fk base contacts, nullable), program (platform/academy/whitbyos — platform = unsigned Platform display until first product entry; whitbyos = Whitby; academy = Academy), product, source (link/code/manual/campaign/admin), referral_date, status (referred/in_progress/converted/not_converted), conversion_event_date (nullable), created_at

### `partner_opportunities`
id, partner_profile_id (fk), company_id (fk base companies), primary_contact_id (fk base contacts), product_interest (text slug → `partner_opportunity_product_interests.value`; defaults academy_seats/platform_users/combined/other), estimated_seats, estimated_value (nullable), status (submitted/accepted/in_progress/converted/not_moving_forward), accepted_at (nullable), protected_until (accepted_at + 180 days), notes, permission_to_contact (bool), attachment_document_id (fk base documents, nullable), created_at

### `partner_opportunity_product_interests`
id, value (unique slug), label, sort_order, active (bool), created_at, updated_at — Admin-configurable Opportunity product-interest options (§17.6.6). Seeded with Academy Seats / Platform Users / Combined / Other / Custom. Authenticated SELECT; service-role writes.

### `partner_attribution_events`
id, partner_profile_id (fk), referral_id (fk, nullable), opportunity_id (fk, nullable), referred_user_id (fk base users, nullable when opportunity_id is set), product, qualifying_action, event_source (stripe/quickbooks), external_payment_id, amount_collected_cents (nullable), event_timestamp, created_at. Check: `referral_id IS NOT NULL OR opportunity_id IS NOT NULL`. Unique partial indexes: `(partner_profile_id, external_payment_id)` and global `(external_payment_id)` where `external_payment_id IS NOT NULL` (§17.7.11 — one economic payment → one event).

### `partner_earnings`
id, attribution_event_id (fk), partner_profile_id (fk), commission_rule_id (fk), amount, status (pending/approved/payable/paid/held/payout_locked/reversed/ineligible — `held` = §17.1.12 waiting period only; `payout_locked` = in-flight payout batch lock, assumed default outside SRS §17.7.7), collected_payment_source (stripe/quickbooks), collected_payment_ref, payable_date (nullable), paid_date (nullable), governing_document_id (fk documents, nullable — §14.11), terms_version (text, nullable — §17.14.13), created_at, updated_at

### `partner_earning_adjustments`
id, earning_id (fk), type (refund/chargeback/manual), amount_delta, reason, external_ref (nullable, idempotency key), applied_at (nullable, set when netted into a payout), created_by_admin_user_id (fk), created_at

### `partner_payouts`
id, partner_profile_id (fk), amount, method (stripe_connect/quickbooks/ach/check), status (scheduled/paid/failed), reference, paid_at (nullable), created_at

### `partner_platform_attribution_config`
id, default_cookie_life_days (default 90), attribution_mode (first_touch/last_touch), default_refund_rule (full/proportional/future_negative_after_payout), conversion_eligibility (jsonb — academy/platform commissionable actions), firstpromoter_enabled (bool), firstpromoter_account_id (text, nullable), updated_by_user_id, created_at, updated_at — singleton (§17.14.5, §17.5.13–14, §17.14.14). Service-role writes.

### `partner_firstpromoter_mappings`
id, partner_profile_id (fk), promoter_id (unique), campaign_id (nullable), program (nullable partner_program_family), created_at, updated_at — maps FirstPromoter promoter → Whitby partner (§17.14.14).

### `partner_fp_webhook_events`
id (FirstPromoter event id, text PK), processed_at — idempotency store for FP webhooks (§17.15.6). Service-role only.

### `partner_tax_profiles`
id, partner_profile_id (fk), legal_payee_name, business_dba_name, entity_classification, mailing_address, country, tin_last4 (masked), form_type (w9/w8/other), status (not_started/in_progress/complete/needs_attention/review_required/expired), collection_source (stripe_tax/quickbooks_w9/other), external_record_id, certified_at, last_reviewed_at

### `partner_admins`
id, email (unique, lowercased), user_id (fk users, nullable until claim), status (`invited` / `active` / `revoked`), invite_token_hash (nullable), invite_expires_at, invited_by_email, invited_at, activated_at, revoked_at, created_at, updated_at — Partner Admin staff role (no partner profile / entitlement). RLS closed to JWT clients; service-role only. Invite claim: `claim_partner_admin_invite` / `activate_partner_admin_on_signin` (single-use).

### `partner_messages`
id, partner_profile_id (fk), sender_type (partner/staff), sender_contact_id (fk base contacts, nullable — set when sender_type is partner), body, channel (`partner_manager` / `support_billing`, default `partner_manager` for new rows; existing backfilled to `support_billing`), created_at

Two conversations per partner profile (Partner Manager vs Support and Billing). Partners send as `partner`; staff messages use `staff` (service role only).

### `partner_message_reads`
partner_profile_id (fk), user_id (fk base users), last_read_at — **PK (partner_profile_id, user_id)** per-user unread cursor.

### `partner_message_staff_reads`
partner_profile_id (fk), channel, last_read_at, reader_user_id (fk base users, nullable) — **PK (partner_profile_id, channel)** staff inbox cursor per channel.

### `partner_admin_notifications`
id, kind, title, body, href, entity_type, entity_id, channel (`partner_manager` / `support_billing`), created_at — staff admin push/in-app notifications. Realtime-enabled. **SELECT** denied for JWT clients; staff app reads via service role. Partner Manager notifies active Partner Admins (fallback Super Admin); Support and Billing notifies Super Admin.

### `partner_admin_notification_staff_reads`
notification_id (fk), staff_email, read_at — **PK (notification_id, staff_email)** staff cookie/Auth email read state (service-role only).

### `partner_notifications`
id, partner_profile_id (fk), kind, title, body, href, entity_type, entity_id, created_at — partner in-app feed (e.g. opportunity status updates). Realtime-enabled. RLS via `is_partner_member`. Inserts service-role only.

### `partner_notification_reads`
notification_id (fk), user_id (fk base users), read_at — **PK (notification_id, user_id)** per-user read state.

### `partner_enterprise_protection_rules`
id, acceptance_required (bool, default true), protection_period_days (default 180), renewal_extension_notes, conflict_resolution_notes, updated_by_user_id (fk users, nullable), created_at, updated_at — global Enterprise protection config (§17.14.10). Seeded with one default row.

### `partner_integration_credentials`
id, provider (`quickbooks` | `firstpromoter`), status (connected/needs_attention/disconnected), realm_id, access_token, refresh_token, token_expires_at, scopes, connected_account, last_sync_at, error_state, updated_by_user_id, created_at, updated_at — platform Intuit / FirstPromoter credentials (§17.15.4, §17.15.6). Unique(provider). Service-role only.

### `partner_qb_webhook_events`
id (Intuit event id, text PK), processed_at — idempotency store for QB webhooks (§17.15.5). Service-role only.

### `partner_platform_tax_config`
id, legal_payer_entity, available_payout_methods (text[] — stripe_connect/quickbooks/ach/check), tax_form_type (w9/w8/other), tax_collection_source (stripe_tax/quickbooks_w9/other), updated_by_user_id, created_at, updated_at — singleton platform tax/payout admin config (§17.14.15). Service-role writes; seeded with one default row.

### `partner_1099_rollups`
id, tax_year, legal_payer_entity, partner_profile_id (fk), reportable_total, stripe_paid_total, quickbooks_paid_total (includes ach/check as non-Stripe paid in v1), adjustments, status (not_started/in_progress/complete/filed), reference, created_at, updated_at. Unique(tax_year, legal_payer_entity, partner_profile_id). Annual 1099 aggregation across rails (§17.12.9–10).

### `partner_document_meta`
Partner-only metadata for rows in base `documents` (`context_type='partner_profile'`). Does not fork the shared library.

| Field | Type | Notes |
|---|---|---|
| document_id | uuid, pk, fk → documents.id | cascade delete |
| partner_profile_id | fk → partner_profiles.id | |
| program | partner_program_family, nullable | §17.11.2 Program column/filter; null → UI "—" |
| expiration_date | date, nullable | §17.11.4 agreement expiration/renewal |
| external_signature_ref | text, nullable | §17.11.4 external signature reference |
| document_kind | enum | agreement / program_terms / guideline / marketing / tax / other |
| needed_action | enum, nullable | review / sign_externally / upload / update (§14.6) |
| created_at / updated_at | timestamp | |

*(File bytes, title, status, visibility, version, effective_date, signed_date stay on base `documents`. Freeform tags stay on `document_labels`. Tax certs use `visibility=restricted` and/or `document_kind=tax`.)*

---

## Cross-Module Foreign Key Cheat Sheet

- Every table that references a person → base `users.id` or base `contacts.id`. Never a locally duplicated identity column.
- `partner_attribution_events.referred_user_id` → `users.id`
- `partner_profiles.company_id` / `.primary_contact_id` → `companies.id` / `contacts.id`
- `whitbyos_providers.contact_id` / `.company_id` → `contacts.id` / `companies.id`
- `whitbyos_client_members.contact_id` → `contacts.id`
- `academy_training_workspaces.workspace_id` → `workspaces.id` (created by Sabahat's schema, referenced by Rahat's)
- `documents.context_id` → varies by `context_type` (polymorphic; no formal FK constraint possible here, enforce in application layer)

## Setup Recommendation

Building all schemas up front, before each dev starts, is the right call for this project specifically — it's what prevents the exact duplication problem (separate identity tables, separate document tables per module) that would otherwise surface only after four people have already built on top of their own divergent assumptions. Two suggestions on top of what's here:

1. Put this schema in a migration tool (Prisma, Drizzle, or plain SQL migrations) committed to the `base` branch, rather than manually clicking through a DB GUI — so every dev pulls the same schema via `git pull` + `migrate` instead of you re-creating it by hand if it ever needs a tweak.
2. Give each dev write access scoped to their own prefixed tables where your DB supports it (Postgres row-level grants, or just a team norm enforced in code review) — nobody should need to alter `users` or `documents` to ship a feature in their own module; if they think they do, that's the signal to come back to this schema first.
