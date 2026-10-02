import { ACADEMY_QUESTION_TYPES, type AcademyQuestionType } from "@/academy/lib/domain";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

export function QuestionTypeSelector({
  value,
  disabled,
  onChange,
}: {
  value: AcademyQuestionType;
  disabled?: boolean;
  onChange: (value: AcademyQuestionType) => void;
}) {
  return (
    <FilterSelect
      tone="field"
      size="md"
      label="Question type"
      value={value}
      disabled={disabled}
      onChange={(next) => onChange(next as AcademyQuestionType)}
      options={ACADEMY_QUESTION_TYPES.map((type) => ({
        value: type,
        label: type === "multiple_choice" ? "Multiple choice" : "True / False",
      }))}
    />
  );
}
