import { Input } from "@/base/components/Input";
import type { EditorProgram } from "../types";
import { DESCRIPTION_MAX, TITLE_MAX } from "../utils/validation";
import {
  DEFAULT_ACCESS_BY_TYPE,
  DEFAULT_LEARNING_PATH_BY_TYPE,
  DEFAULT_VALIDITY_BY_RECOGNITION,
  courseRecognitionOptions,
  credentialValidityOptions,
  learningPathOptions,
  programTypeForRecognition,
} from "@/academy/lib/courseMetadata";
import type {
  AcademyCourseRecognition,
  AcademyCredentialValidity,
  AcademyLearningPath,
} from "@/academy/lib/domain";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import { PricingAccessField } from "@/academy/components/PricingAccessField";
import { CourseTagsFieldLoader } from "@/academy/components/CourseTagsFieldLoader";

export function ProgramDetailsForm({
  program,
  disabled,
  onChange,
}: {
  program: EditorProgram;
  disabled?: boolean;
  onChange: (patch: Partial<EditorProgram>) => void;
}) {
  return (
    <section className="space-y-4">
      <Input
        label="Name"
        name="name"
        value={program.name}
        maxLength={TITLE_MAX}
        disabled={disabled}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <FilterSelect
        tone="field"
        size="md"
        label="Certificate classification"
        value={
          program.recognition === "none" ? "certificate_of_completion" : program.recognition
        }
        disabled={disabled}
        onChange={(value) => {
          const nextRecognition = value as AcademyCourseRecognition;
          const nextType = programTypeForRecognition(nextRecognition, program.type);
          onChange({
            recognition: nextRecognition,
            type: nextType,
            access: program.access || DEFAULT_ACCESS_BY_TYPE[nextType],
            learningPath: program.learningPath || DEFAULT_LEARNING_PATH_BY_TYPE[nextType],
            credentialValidity:
              program.credentialValidity === "three_years" || program.credentialValidity === "none"
                ? program.credentialValidity
                : DEFAULT_VALIDITY_BY_RECOGNITION[nextRecognition],
          });
        }}
        options={courseRecognitionOptions()}
      />
      <FilterSelect
        tone="field"
        size="md"
        label="Learning path"
        value={program.learningPath}
        disabled={disabled}
        onChange={(value) => onChange({ learningPath: value as AcademyLearningPath })}
        options={learningPathOptions()}
      />
      <div>
        <FilterSelect
          tone="field"
          size="md"
          label="Certificate validity"
          value={program.credentialValidity || "none"}
          disabled={disabled}
          onChange={(value) =>
            onChange({ credentialValidity: value as AcademyCredentialValidity })
          }
          options={credentialValidityOptions()}
        />
        <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          {program.credentialValidity === "three_years"
            ? "Awards expire 3 years after the award date. Learners get email reminders at 90, 60, and 30 days before expiry."
            : "Certificates from this program do not expire. Choose 3 years for renewable credentials such as Certified Private Attaché."}
        </p>
      </div>
      <PricingAccessField
        access={program.access}
        price={program.price}
        disabled={disabled}
        onAccessChange={(next) =>
          onChange({
            access: next,
            ...(next === "free" ? { price: "" } : {}),
          })
        }
        onPriceChange={(price) => onChange({ price })}
      />
      <CourseTagsFieldLoader
        value={program.tagIds ?? []}
        disabled={disabled}
        onChange={(tagIds) => onChange({ tagIds })}
      />
      <label className="block">
        <span
          className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Description
        </span>
        <textarea
          name="description"
          value={program.description}
          maxLength={DESCRIPTION_MAX}
          rows={4}
          disabled={disabled}
          onChange={(event) => onChange({ description: event.target.value })}
          className="w-full rounded-[6px] border bg-surface px-3 py-[9px] text-[14.5px] text-ink disabled:opacity-60"
          style={{ borderColor: "var(--border-strong)" }}
        />
      </label>
      <FilterSelect
        tone="field"
        size="md"
        label="Prerequisite"
        value={program.prerequisiteProgramId}
        disabled={disabled}
        placeholder="None"
        onChange={(value) => onChange({ prerequisiteProgramId: value })}
        options={[
          { value: "", label: "None" },
          ...program.prerequisites.map((item) => ({ value: item.id, label: item.name })),
        ]}
      />
    </section>
  );
}
