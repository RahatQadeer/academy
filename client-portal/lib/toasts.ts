/**
 * The confirmation sentences server actions redirect with.
 *
 * Plain data in a plain module, deliberately not beside `Toast` in
 * `client-portal/components/Toast.tsx`. That file is `"use client"`, and a value
 * imported from a client module into a server one does not arrive as itself: the
 * server graph gets a client reference in its place, so `TOASTS.messageSent`
 * read `undefined` and every action redirected to `?toast=undefined`. The toast
 * then rendered the word. Nothing about the type flagged it, because to
 * TypeScript the import is the object.
 */
export const TOASTS = {
  requestSubmitted: "Request submitted successfully.",
  formSaved: "Draft saved.",
  formSubmitted: "Form submitted. Thank you.",
  formResubmitted: "Corrections submitted. Your team will review them.",
  conversationStarted: "Conversation started. Your team has been notified.",
  documentUploaded: "Document uploaded and shared with your team.",
  labelAdded: "Label applied.",
  planShared: "Update shared with your team.",
  taskCompleted: "Task marked complete. Your team has been told.",
  taskReopened: "Task reopened. Your team has been told.",
  profileSaved: "Profile updated.",
  preferencesSaved: "Preferences saved.",
  notificationsSaved: "Notification preferences saved.",
  privacySaved: "Privacy settings saved.",
  passwordChanged: "Password updated.",
  paymentStarted: "Payment started, you'll receive a receipt by email.",
  integrationChanged: "Connection updated.",
} as const;
