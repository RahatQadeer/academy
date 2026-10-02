import { Input } from "@/base/components/Input";
import type { PrerequisiteOption } from "../types";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

export function InstructorCatalogFields({
  price,
  prerequisiteProgramId,
  prerequisites,
  disabled,
  onChange,
}: {
  price: string;
  prerequisiteProgramId: string;
  prerequisites: PrerequisiteOption[];
  disabled?: boolean;
  onChange: (patch: { price?: string; prerequisiteProgramId?: string }) => void;
}) {
  return (
    <div className="mx-auto max-w-[760px] px-6 pb-10 sm:px-10">
      <div className="border-b py-7" style={{ borderColor: "var(--border)" }}>
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
            Pricing
          </h3>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Free or Paid. Price is charged at checkout when learners purchase. Publishing may require Academy Admin approval depending on your assignment permissions.
          </p>
        </div>
        <div className="space-y-5">
          <Input
            label="Price"
            name="price"
            value={price}
            disabled={disabled}
            inputMode="decimal"
            hint="Leave blank for a free program."
            onChange={(event) => onChange({ price: event.target.value })}
          />
          <div>
            <FilterSelect
              tone="field"
              size="md"
              label="Prerequisite"
              value={prerequisiteProgramId}
              disabled={disabled}
              placeholder="None"
              onChange={(value) => onChange({ prerequisiteProgramId: value })}
              options={[
                { value: "", label: "None" },
                ...prerequisites.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              Optional. Specialty endorsements do not require Certified Private Attaché unless you set that here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
