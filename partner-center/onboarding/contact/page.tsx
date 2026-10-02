import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { PrimaryContactForm } from "@/partner-center/onboarding/components/PrimaryContactForm";

export default async function PartnerContactPage() {
  const { context } = await requirePartnerChecklistAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  const contact = context?.contact;
  const name = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : application.primary_contact_name;

  return (
    <PrimaryContactForm
      name={name}
      phone={contact?.phone || application.phone}
      email={contact?.email || application.email}
    />
  );
}
