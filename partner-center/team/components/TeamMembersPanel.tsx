import { TeamMembersTable } from "@/partner-center/team/components/TeamMembersTable";
import type { TeamPageData } from "@/partner-center/team/types";

export function TeamMembersPanel({ data }: { data: TeamPageData }) {
  return (
    <div className="mt-6">
      <TeamMembersTable data={data} />
    </div>
  );
}
