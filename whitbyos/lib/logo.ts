/**
 * Kept as a re-export so Whitby's existing imports keep working. The function
 * itself moved to `base/lib/logo.ts`, because the app shell needs it too and
 * base cannot reach into a product folder.
 */
export { getWorkspaceLogoUrl } from "@/base/lib/logo";
