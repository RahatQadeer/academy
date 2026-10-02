-- Private Attaché — extensions, enums, and shared helpers

create extension if not exists "pgcrypto";

-- Identity
create type public.user_status as enum ('active', 'suspended', 'deleted');
create type public.workspace_member_role as enum (
  'owner', 'admin', 'team_lead', 'coordinator', 'billing', 'viewer'
);
create type public.workspace_member_status as enum ('active', 'invited', 'suspended');
create type public.product_key as enum (
  'whitbyos', 'client_portal', 'academy', 'partner_center'
);
create type public.entitlement_status as enum ('active', 'trial', 'expired', 'revoked');
create type public.invitation_context_type as enum (
  'team_member', 'client_member', 'client_authorized_user', 'partner_team'
);
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

-- Canonical records
create type public.contact_related_type as enum (
  'client', 'company', 'request', 'workstream', 'partner_profile'
);
create type public.contact_role_label as enum (
  'primary_member',
  'additional_member',
  'authorized_user',
  'dependent',
  'primary_contact',
  'billing_contact',
  'decision_maker',
  'authorized_representative',
  'provider',
  'partner_company_admin',
  'partner_referral_contact',
  'partner_billing_contact',
  'partner_authorized_signer',
  'partner_read_only'
);
create type public.document_context_type as enum (
  'client', 'request', 'workstream', 'partner_profile', 'company', 'contact'
);
create type public.visibility_level as enum ('internal', 'client_visible', 'restricted');
create type public.document_status as enum (
  'current', 'action_needed', 'completed', 'archived'
);
create type public.taxonomy_sensitivity as enum ('normal', 'sensitive');

-- Whitby
create type public.whitbyos_client_type as enum (
  'individual', 'family', 'company', 'organization'
);
create type public.whitbyos_request_visibility as enum (
  'private_to_requestor', 'selected_people', 'client_account'
);
create type public.whitbyos_workplan_status as enum (
  'draft', 'active', 'paused', 'complete'
);
create type public.whitbyos_workstream_status as enum (
  'not_started', 'active', 'waiting', 'paused', 'complete'
);
create type public.whitbyos_provider_readiness as enum (
  'prospect', 'screened', 'qualified', 'preferred', 'inactive', 'excluded'
);
create type public.whitbyos_provider_option_status as enum (
  'option_for_review', 'shortlisted', 'selected', 'confirmed'
);
create type public.whitbyos_consideration_type as enum (
  'missing_info',
  'dependency_conflict',
  'stale_info',
  'risk_backup_gap',
  'calendar_conflict',
  'requirement_prompt',
  'next_action'
);
create type public.whitbyos_consideration_status as enum (
  'open', 'dismissed', 'resolved'
);
create type public.whitbyos_update_type as enum ('progress_update', 'plans_update');
create type public.whitbyos_update_status as enum ('draft', 'review', 'published');
create type public.whitbyos_integration_provider as enum (
  'gmail', 'outlook_mail', 'google_calendar', 'outlook_calendar', 'stripe', 'quickbooks'
);
create type public.whitbyos_integration_status as enum (
  'connected', 'needs_attention', 'disconnected', 'available'
);

-- Client portal
create type public.client_portal_access_status as enum (
  'pending', 'approved_as_requested', 'approved_edited', 'declined'
);

-- Academy
create type public.academy_program_type as enum (
  'cpa',
  'professional_practice_accelerator',
  'specialty_endorsement',
  'intelligent_coordination',
  'free_course',
  'paid_course'
);
create type public.academy_program_status as enum (
  'draft', 'pending_approval', 'published'
);
create type public.academy_lesson_type as enum ('video', 'reading', 'attachment', 'quiz');
create type public.academy_enrollment_status as enum (
  'enrolled', 'in_progress', 'completed'
);
create type public.academy_progress_status as enum (
  'locked', 'in_progress', 'completed'
);
create type public.academy_credential_type as enum (
  'cpa_credential', 'specialty_endorsement', 'certificate_of_completion'
);
create type public.academy_credential_status as enum (
  'required_learning', 'applied_work', 'final_assessment', 'credential_review', 'awarded'
);
create type public.academy_publish_status as enum ('pending', 'approved', 'rejected');
create type public.academy_training_status as enum ('active', 'expired');

-- Partner
create type public.partner_profile_status as enum (
  'applied', 'under_review', 'approved', 'active', 'declined'
);
create type public.partner_program_family as enum ('academy', 'platform', 'enterprise');
create type public.partner_rate_type as enum ('percentage', 'flat');
create type public.partner_link_type as enum (
  'referral_link', 'access_code', 'campaign_event'
);
create type public.partner_referral_status as enum (
  'referred', 'in_progress', 'converted', 'not_converted'
);
create type public.partner_opportunity_status as enum (
  'submitted', 'accepted', 'in_progress', 'converted', 'not_moving_forward'
);
create type public.partner_earning_status as enum (
  'pending', 'approved', 'payable', 'paid', 'held', 'payout_locked', 'reversed', 'ineligible'
);
create type public.partner_payout_method as enum (
  'stripe_connect', 'quickbooks', 'ach', 'check'
);
create type public.partner_payout_status as enum ('scheduled', 'paid', 'failed');
create type public.partner_tax_status as enum (
  'not_started', 'in_progress', 'complete', 'needs_attention', 'review_required', 'expired'
);
create type public.partner_payout_eligibility as enum (
  'eligible', 'needs_tax_setup', 'needs_payment_setup', 'on_hold'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
