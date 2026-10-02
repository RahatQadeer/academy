import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { createProvider } from "@/whitbyos/providers/actions";
import {
  ProviderFields,
  type ProviderValues,
  type Teammate,
} from "@/whitbyos/providers/components/ProviderForm";
import type { CategoryOption } from "@/whitbyos/lib/taxonomy";
import type { CompanyOption } from "@/whitbyos/lib/providers";

/**
 * Screen 5.0a — Add Provider.
 *
 * One difference from the export, and it is a data one. A provider is a
 * relationship with a company, and companies are base records shared with the
 * Portal and the Partner Center (§5.4) — so where the workspace already knows
 * the company, this offers it rather than creating a second one under the same
 * name. Naming a new one still creates it, because being told to go and add the
 * company first is the detour that gets a provider written on paper instead.
 */
export function AddProviderDialog({
  companies,
  teammates,
  clients,
  categories,
  usedSpecialties,
  defaultClientId,
  atFirm,
  values,
  existingContactId,
  errorTo,
  inherit,
  firmProviderId,
  defaultOwnerId,
  returnTo,
  closeHref,
  error,
}: {
  companies: CompanyOption[];
  teammates: Teammate[];
  clients: { id: string; name: string }[];
  categories: CategoryOption[];
  usedSpecialties: string[];
  /** The client workspace that is open, if one is. */
  defaultClientId?: string | null;
  /** Opened from inside a provider company, rather than from the directory. */
  atFirm?: { id: string; name: string } | null;
  /** Filling in somebody the firm already holds as a contact. */
  values?: ProviderValues;
  existingContactId?: string | null;
  /** Where a refused submission should reopen this same dialog. */
  errorTo?: string;
  /** The firm's own answers, for somebody being filed inside it. */
  inherit?: {
    category?: string | null;
    location?: string | null;
    source?: string | null;
    readiness?: string | null;
    outreach?: string | null;
  };
  firmProviderId?: string | null;
  /** The firm's own owner, inherited rather than asked for again. */
  defaultOwnerId?: string | null;
  /** Where to land afterwards, when that is not the list. */
  returnTo?: string;
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal
      title={
        existingContactId
          ? `Edit ${values?.name ?? "person"}`
          : atFirm
            ? `Add someone at ${atFirm.name}`
            : "Add Provider"
      }
      closeHref={closeHref}
      width={560}
    >
      <form action={createProvider} className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
        {existingContactId ? (
          <input type="hidden" name="existing_contact_id" value={existingContactId} />
        ) : null}
        {errorTo ? <input type="hidden" name="error_to" value={errorTo} /> : null}

        <ProviderFields
          values={{ ...values, clientId: defaultClientId, ownerId: defaultOwnerId }}
          teammates={teammates}
          companies={companies}
          /* A person can be placed at a firm that is itself a provider. */
          firms={companies.filter((company) => company.isProvider)}
          clients={clients}
          categories={categories}
          usedSpecialties={usedSpecialties}
          atFirm={atFirm}
          inherit={inherit}
          firmProviderId={firmProviderId}
          showPeople
          nameLabel={atFirm ? "Name" : "Provider Name"}
          namePlaceholder={atFirm ? "Their name" : undefined}
        />

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          {/* The verb the button performs: filling in somebody already on
              file is saving them, not adding them again. */}
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            {existingContactId ? "Save" : atFirm ? "Add person" : "Add Provider"}
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
