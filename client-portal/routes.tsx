import { notFound } from "next/navigation";
import { param, type SearchParams } from "@/client-portal/lib/routing";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { Toast } from "@/client-portal/components/Toast";
import { NoAccess } from "@/client-portal/components/NoAccess";
import type { PortalArea } from "@/client-portal/types";

import HomeScreen from "./home/page";
import RequestsScreen from "./requests/page";
import TasksScreen from "./tasks/page";
import RequestDetailScreen from "./requests/detail/page";
import PlanScreen from "./requests/plan/page";
import PlanStreamScreen from "./requests/plan/stream/page";
import CalendarScreen from "./calendar/page";
import MessagesScreen from "./messages/page";
import UpdatesScreen from "./updates/page";
import FormsScreen from "./forms/page";
import FormDetailScreen from "./forms/detail/page";
import DocumentsScreen from "./documents/page";
import BillingScreen from "./billing/page";
import IntegrationsScreen from "./integrations/page";
import GmailScreen from "./integrations/gmail/page";

import OnboardingAboutScreen from "./onboarding/about/page";
import OnboardingPreferencesScreen from "./onboarding/preferences/page";
import OnboardingPeopleScreen from "./onboarding/people/page";
import OnboardingReviewScreen from "./onboarding/review/page";
import OnboardingWelcomeScreen from "./onboarding/welcome/page";

import ProfileSettingsScreen from "./settings/profile/page";
import PreferencesSettingsScreen from "./settings/preferences/page";
import NotificationSettingsScreen from "./settings/notifications/page";
import PeopleSettingsScreen from "./settings/people/page";
import SecuritySettingsScreen from "./settings/security/page";
import PrivacySettingsScreen from "./settings/privacy/page";

const SETTINGS = {
  profile: ProfileSettingsScreen,
  preferences: PreferencesSettingsScreen,
  notifications: NotificationSettingsScreen,
  people: PeopleSettingsScreen,
  security: SecuritySettingsScreen,
  privacy: PrivacySettingsScreen,
} as const;

/**
 * The area each top-level section belongs to.
 *
 * The gate of last resort. The nav omits what a client cannot open and every
 * write action refuses independently, but a URL is typed, pasted and bookmarked
 * — so the permission is checked again here, once, where every screen in the
 * module passes through.
 *
 * Home, Settings and Onboarding are the only sections absent, and each for its
 * own reason. Home assembles itself from the areas its reader holds. Settings
 * and Onboarding are how somebody manages their own account — password,
 * notifications, contact details — which no grant confers and none removes;
 * People & Access is the one page under Settings that is about the *account*
 * rather than the reader, and it gates its own roster on `people` from inside.
 */
const AREA_FOR_SECTION: Record<string, PortalArea> = {
  requests: "requests",
  // Tasks has no area of its own. A task is part of the work a Request
  // describes even where it is not filed under one, so it is granted and
  // refused with Requests — which is the same gate `listTasks` applies.
  // The screen carries every one of them; see its own note.
  tasks: "requests",
  messages: "messages",
  calendar: "calendar",
  documents: "documents",
  forms: "forms",
  updates: "updates",
  billing: "billing",
  integrations: "integrations",
};

const ONBOARDING = {
  about: OnboardingAboutScreen,
  preferences: OnboardingPreferencesScreen,
  people: OnboardingPeopleScreen,
  review: OnboardingReviewScreen,
  welcome: OnboardingWelcomeScreen,
} as const;

/**
 * Every Client Portal URL resolves here. `/app` only forwards the slug and search
 * params, so adding a screen never means touching shared routing glue.
 */
export async function resolvePortalRoute(
  slug: string[],
  searchParams: SearchParams,
) {
  const screen = await renderScreen(slug, searchParams);
  const toast = param(searchParams, "toast");

  return (
    <>
      {screen}
      {toast ? <Toast message={toast} closeHref={withoutToast(slug, searchParams)} /> : null}
    </>
  );
}

/**
 * The current URL with `toast` taken off it — where the toast sends the page
 * once it has been read, so a refresh does not bring back a confirmation for
 * something that happened minutes ago.
 */
function withoutToast(slug: string[], searchParams: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "toast" || value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) query.append(key, one);
  }
  const path = ["/client-portal", ...slug].join("/");
  const rest = query.toString();
  return rest ? `${path}?${rest}` : path;
}

async function renderScreen(slug: string[], searchParams: SearchParams) {
  const [section, second] = slug;
  const props = { slug, searchParams };

  if (!section) return <HomeScreen {...props} />;

  const area = AREA_FOR_SECTION[section];
  if (area) {
    const { areas } = await getPortalContext();
    if (!areas[area]) return <NoAccess area={area} />;
  }

  switch (section) {
    case "requests": {
      if (!second) return <RequestsScreen {...props} />;

      // /requests/<id>/plans/<planId>[/streams/<streamId>] — a shared Work
      // Plan and one of its streams, laid out as Whitby lays out /work-plans.
      const [, , sub, planId, streams, streamId] = slug;
      if (sub === "plans" && planId) {
        return streams === "streams" && streamId ? (
          <PlanStreamScreen
            requestId={second}
            planId={planId}
            streamId={streamId}
            searchParams={searchParams}
          />
        ) : (
          <PlanScreen requestId={second} planId={planId} searchParams={searchParams} />
        );
      }
      if (sub) notFound();

      return <RequestDetailScreen requestId={second} searchParams={searchParams} />;
    }

    case "forms":
      return second ? (
        <FormDetailScreen formId={second} />
      ) : (
        <FormsScreen {...props} />
      );

    case "tasks":
      return <TasksScreen {...props} />;

    case "calendar":
      return <CalendarScreen {...props} />;
    case "messages":
      return <MessagesScreen {...props} />;
    case "updates":
      return <UpdatesScreen {...props} />;
    case "documents":
      return <DocumentsScreen {...props} />;
    // One list and no tabs, so it takes nothing from the URL either.
    case "billing":
      return <BillingScreen />;
    // Manage, Disconnect and Connect open over the list from the URL, and
    // /integrations/gmail is what a connected Gmail has read.
    case "integrations":
      if (!second) return <IntegrationsScreen {...props} />;
      if (second === "gmail" && !slug[2]) return <GmailScreen {...props} />;
      notFound();

    case "settings": {
      const Screen = SETTINGS[(second ?? "profile") as keyof typeof SETTINGS];
      if (!Screen) notFound();
      return <Screen {...props} />;
    }

    case "onboarding": {
      const Screen = ONBOARDING[(second ?? "about") as keyof typeof ONBOARDING];
      if (!Screen) notFound();
      return <Screen {...props} />;
    }

    default:
      notFound();
  }
}
