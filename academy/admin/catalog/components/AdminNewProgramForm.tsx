"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { createAdminProgramAction } from "@/academy/admin/actions";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
} from "@/academy/instructor/programs/utils/validation";
import {
  DEFAULT_ACCESS_BY_TYPE,
  DEFAULT_LEARNING_PATH_BY_TYPE,
  DEFAULT_RECOGNITION_BY_TYPE,
  DEFAULT_VALIDITY_BY_RECOGNITION,
  courseRecognitionOptions,
  credentialValidityOptions,
  learningPathOptions,
  programTypeForRecognition,
  toPricingAccess,
} from "@/academy/lib/courseMetadata";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import { Surface } from "@/academy/components/ui/Surface";
import { PricingAccessField } from "@/academy/components/PricingAccessField";
import { CourseTagsFieldLoader } from "@/academy/components/CourseTagsFieldLoader";
import {
  COURSE_TAG_MAX,
  validateProgramTagIds,
} from "@/academy/lib/courseTags/constants";
import type {
  AcademyCourseAccess,
  AcademyCourseRecognition,
  AcademyCredentialValidity,
  AcademyLearningPath,
  AcademyProgramType,
} from "@/academy/lib/domain";

export function AdminNewProgramForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [type, setType] = useState<AcademyProgramType>("course");
  const [access, setAccess] = useState<AcademyCourseAccess>(DEFAULT_ACCESS_BY_TYPE.course);
  const [price, setPrice] = useState("");
  const [recognition, setRecognition] = useState<AcademyCourseRecognition>(
    DEFAULT_RECOGNITION_BY_TYPE.course,
  );
  const [learningPath, setLearningPath] = useState<AcademyLearningPath>(
    DEFAULT_LEARNING_PATH_BY_TYPE.course,
  );
  const [credentialValidity, setCredentialValidity] = useState<AcademyCredentialValidity>(
    DEFAULT_VALIDITY_BY_RECOGNITION[DEFAULT_RECOGNITION_BY_TYPE.course],
  );

  const tagsOk = !validateProgramTagIds(tagIds);
  const canCreate =
    name.trim().length > 0 && tagsOk && !pending && (toPricingAccess(access) === "free" || price.trim());

  function onRecognitionChange(next: AcademyCourseRecognition) {
    const nextType = programTypeForRecognition(next, type);
    setRecognition(next);
    setType(nextType);
    setLearningPath(DEFAULT_LEARNING_PATH_BY_TYPE[nextType]);
    setCredentialValidity(DEFAULT_VALIDITY_BY_RECOGNITION[next]);
    const nextAccess = access || DEFAULT_ACCESS_BY_TYPE[nextType];
    setAccess(nextAccess);
  }

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const tagError = validateProgramTagIds(tagIds);
        if (tagError) {
          setError(tagError);
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await createAdminProgramAction({
            name: String(form.get("name") ?? ""),
            type,
            access,
            recognition,
            learningPath,
            credentialValidity,
            category: "",
            description: String(form.get("description") ?? ""),
            price: toPricingAccess(access) === "free" ? "" : price,
            tagIds,
          });
          if (!result.ok) {
            setError(result.message ?? "The program could not be created.");
            return;
          }
          router.push(`/academy/admin/catalog/${result.programId}`);
        });
      }}
    >
      <Surface elevated className="w-full overflow-hidden">
        <FormSection title="Program" first>
          <Input
            label="Name"
            name="name"
            required
            maxLength={TITLE_MAX}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Program title"
          />
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              Description
            </span>
            <textarea
              name="description"
              maxLength={DESCRIPTION_MAX}
              rows={4}
              placeholder="Optional summary shown in the catalog"
              className="w-full resize-none rounded-[8px] border bg-surface px-3 py-[9px] text-[14.5px] leading-[1.5] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-disabled)] hover:border-[var(--text-quiet)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]"
              style={{ borderColor: "var(--border-strong)" }}
            />
          </label>
        </FormSection>

        <FormSection title="Classification">
          <FilterSelect
            tone="field"
            size="md"
            label="Certificate classification"
            value={recognition === "none" ? "certificate_of_completion" : recognition}
            onChange={(value) => onRecognitionChange(value as AcademyCourseRecognition)}
            options={courseRecognitionOptions()}
          />
          <FilterSelect
            tone="field"
            size="md"
            label="Learning path"
            value={learningPath}
            onChange={(value) => setLearningPath(value as AcademyLearningPath)}
            options={learningPathOptions()}
          />
          <FilterSelect
            tone="field"
            size="md"
            label="Certificate validity"
            value={credentialValidity}
            onChange={(value) => setCredentialValidity(value as AcademyCredentialValidity)}
            options={credentialValidityOptions()}
          />
        </FormSection>

        <FormSection title="Pricing">
          <PricingAccessField
            access={access}
            price={price}
            disabled={pending}
            brief
            onAccessChange={(next) => {
              setAccess(next);
              if (next === "free") setPrice("");
            }}
            onPriceChange={setPrice}
          />
        </FormSection>

        <FormSection title="Tags">
          <CourseTagsFieldLoader value={tagIds} disabled={pending} onChange={setTagIds} />
        </FormSection>

        <div
          className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <p
            className="text-[13px] leading-relaxed text-pretty"
            style={{ color: error ? "var(--warning-fg)" : "var(--text-secondary)" }}
          >
            {error
              ? error
              : tagsOk
                ? "Creates a draft. You can edit curriculum before publishing."
                : `Select ${COURSE_TAG_MAX} tags to continue (${tagIds.length}/${COURSE_TAG_MAX}).`}
          </p>
          <Button type="submit" disabled={!canCreate} className="shrink-0">
            {pending ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </Surface>
    </form>
  );
}

function FormSection({
  title,
  first,
  children,
}: {
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={first ? "px-5 py-5 sm:px-6 sm:py-6" : "border-t px-5 py-5 sm:px-6 sm:py-6"}
      style={first ? undefined : { borderColor: "var(--border)" }}
    >
      <h2
        className="mb-4 text-[13px] font-semibold tracking-[-0.1px]"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
