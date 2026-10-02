import { isAcademyAssignmentPermission, type AcademyAssignmentPermission } from "@/academy/lib/domain";
import { permissionHint, permissionLabel } from "@/academy/instructor/utils/labels";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

export function PermissionSelector({
  value,
  disabled,
  onChange,
}: {
  value: AcademyAssignmentPermission;
  disabled?: boolean;
  onChange: (value: AcademyAssignmentPermission) => void;
}) {
  return (
    <div>
      <FilterSelect
        tone="field"
        size="md"
        label="Permission"
        value={value}
        disabled={disabled}
        onChange={(next) => {
          if (isAcademyAssignmentPermission(next)) onChange(next);
        }}
        options={(["create", "edit"] as const).map((permission) => ({
          value: permission,
          label: permissionLabel(permission),
        }))}
      />
      <span className="mt-1.5 block text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {permissionHint(value)}
      </span>
    </div>
  );
}
