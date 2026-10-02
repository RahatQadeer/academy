-- 054 — the three integrations screen 16 draws that the enum could not hold.
--
-- PROVIDERS was six because the enum was six. The Figma export for screen 16
-- lists seven apps, three of which had nowhere to be stored: DocuSign, Google
-- Drive and Slack. They are added here so the screen can be built as drawn.
--
-- DocuSign sends signature requests to people outside Whitby. That is not the
-- native e-signature §14.12 rules out for this version, which is Whitby
-- collecting a signature itself.

alter type public.whitbyos_integration_provider add value if not exists 'docusign';
alter type public.whitbyos_integration_provider add value if not exists 'google_drive';
alter type public.whitbyos_integration_provider add value if not exists 'slack';
