import { Button } from "@/base/components/Button";
import { AREA_LABEL } from "@/client-portal/lib/access";
import { PageBody } from "./PageHeader";
import { StateMessage } from "./States";
import type { PortalArea } from "@/client-portal/types";

/**
 * What a client reaches instead of a screen they are not permitted to open.
 *
 * A page, not a 404. The area exists and they know it does — they were sent a
 * link, or the permission was there last week — so pretending it is not a real
 * address would only make them look for it again. It says what is missing, that
 * nothing is broken, and who can change it.
 *
 * The nav does not draw the item and the actions behind it refuse the write, so
 * arriving here means a link, a bookmark, or a permission narrowed since the
 * page was opened. All three are ordinary, and none of them is the client's
 * mistake.
 */
export function NoAccess({ area }: { area: PortalArea }) {
  const label = AREA_LABEL[area];

  return (
    <PageBody>
      {/* The bar over this already says which area was asked for, so the
          screen goes straight to why it did not open.

          The centred state rather than a card, because this is the whole
          screen and not a panel on one. It is the shape the design gives an
          interruption — a tile, a heading, a sentence and a pair of buttons —
          and a bordered card at the top of an otherwise empty page read as a
          notice that had failed to load the thing underneath it.

          Neutral rather than danger: a permission nobody granted is not a
          fault, and drawing it in red says the client has done something. */}
      <StateMessage
        glyph="⚿"
        title={`${label} is not part of your access`}
        description={`Your team decides which areas of this account each person can reach, and ${label} is not one of yours right now. Nothing is missing or broken — ask your team if you need it.`}
        action={
          <>
            <Button href="/client-portal">Back to Home</Button>
            <Button href="/client-portal/settings/people" variant="secondary">
              See your access
            </Button>
          </>
        }
      />
    </PageBody>
  );
}
