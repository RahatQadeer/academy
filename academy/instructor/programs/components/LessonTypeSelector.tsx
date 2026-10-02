import type { AcademyLessonType } from "@/academy/lib/domain";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import { lessonTypeOptions } from "../utils/validation";

export function LessonTypeSelector({
  value,
  disabled,
  onChange,
}: {
  value: AcademyLessonType;
  disabled?: boolean;
  onChange: (value: AcademyLessonType) => void;
}) {
  return (
    <FilterSelect
      tone="field"
      size="md"
      label="Lesson type"
      value={value}
      disabled={disabled}
      onChange={(next) => onChange(next as AcademyLessonType)}
      options={lessonTypeOptions()}
    />
  );
}
