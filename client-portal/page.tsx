import HomeScreen from "./home/page";

/**
 * Kept as the module's entry point for anything importing `@/client-portal/page`.
 * Real routing goes through `resolvePortalRoute` in `./routes`.
 */
export default function ClientPortalPage() {
  return <HomeScreen slug={[]} searchParams={{}} />;
}
