import type { QuickAddItem } from "@/base/components/QuickAdd";

/**
 * Whitby's Quick Add entries, from the updated Figma (1.1b).
 *
 * Request, Task, Client, Contact, Communication, Note, Document. Playbook was
 * removed on 18 Aug ("a playbook is a saved existing work plan"), and Work
 * Plan on 20 Aug, because a plan is created from inside a Request via its own
 * "+ New Work Plan", never from a global menu with no Request in mind.
 *
 * Request, Communication and Note open as modals over the Dashboard, which is
 * what 1.2, 1.2b and 1.2c draw: the point of Quick Add is not losing the
 * screen you were on. Task, Client, Contact and Document open their own screen,
 * because 1.1b's caption sends Client to 2.2 and Contact to 4.5.
 */
export const QUICK_ADD: QuickAddItem[] = [
  {
    href: "/whitbyos?new=request",
    label: "Request",
    description: "Start new work",
    icon: "\u2630",
  },
  {
    href: "/whitbyos/tasks?new=1",
    label: "Task",
    description: "A new action to do",
    icon: "\u2611",
  },
  {
    href: "/whitbyos/clients?new=1",
    label: "Client",
    description: "A new workspace",
    icon: "\u25d4",
  },
  {
    href: "/whitbyos/contacts?new=1",
    label: "Contact",
    description: "A person or company in a relationship",
    icon: "\u2687",
  },
  {
    href: "/whitbyos?new=communication",
    label: "Communication",
    description: "Log a call, meeting, text or in-person talk",
    icon: "C",
  },
  {
    href: "/whitbyos?new=note",
    label: "Note",
    description: "A quick internal thought or bit of context",
    icon: "\u270e",
  },
  {
    href: "/whitbyos/documents?new=1",
    label: "Document",
    description: "Upload or save something right away",
    icon: "\u2750",
  },
];

/**
 * The same menu, minus what cannot be done from where you are standing.
 *
 * A client workspace is made on the screen that holds them all. Offering it
 * from inside one puts the new client behind whichever workspace happened to
 * be open, which is not where it belongs and not what anybody meant by
 * pressing a plus on a page about one client.
 */
export function quickAddFor({
  insideClient,
  usesClientWorkspaces = true,
}: {
  insideClient: boolean;
  usesClientWorkspaces?: boolean;
}): QuickAddItem[] {
  if (insideClient || !usesClientWorkspaces) {
    return QUICK_ADD.filter((item) => item.label !== "Client");
  }
  return QUICK_ADD;
}
