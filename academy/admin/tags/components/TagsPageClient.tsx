"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { TagsManager } from "./TagsManager";
import type { CourseTag } from "@/academy/lib/courseTags/types";

/** Client shell so Add Tag lives in the page header like Question Bank. */
export function TagsPageClient({ initialTags }: { initialTags: CourseTag[] }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
          Add Tag
        </Button>
      </div>
      <TagsManager
        initialTags={initialTags}
        addOpen={addOpen}
        onRequestAdd={() => setAddOpen(true)}
        onCloseAdd={() => setAddOpen(false)}
      />
    </>
  );
}
