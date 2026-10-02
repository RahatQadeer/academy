"use client";

import { useEffect, useState } from "react";
import { loadCourseTagsAction } from "@/academy/lib/courseTags/actions";
import { listPremadeCourseTags } from "@/academy/lib/courseTags/constants";
import type { CourseTag } from "@/academy/lib/courseTags/types";
import { CourseTagsField } from "@/academy/components/CourseTagsField";

/** Loads the tag bank; premade list is available immediately so the field is never empty. */
export function CourseTagsFieldLoader({
  value,
  disabled,
  onChange,
  error,
  compact,
  hideLabel,
}: {
  value: string[];
  disabled?: boolean;
  onChange: (tagIds: string[]) => void;
  error?: string | null;
  compact?: boolean;
  hideLabel?: boolean;
}) {
  const [tags, setTags] = useState<CourseTag[]>(() => listPremadeCourseTags());
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadCourseTagsAction(false).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        // Keep premade fallback — do not clear the bank.
        setLoadError(null);
        return;
      }
      const active = result.tags.filter((tag) => !tag.archivedAt);
      setTags(active.length > 0 ? active : listPremadeCourseTags());
      setLoadError(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CourseTagsField
      tags={tags}
      value={value}
      disabled={disabled}
      onChange={onChange}
      error={error ?? loadError}
      compact={compact}
      hideLabel={hideLabel}
    />
  );
}
