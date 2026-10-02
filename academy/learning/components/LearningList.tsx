import type { LearningItem } from "../types";
import { LearningCard } from "./LearningCard";

export function LearningList({ items }: { items: LearningItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <LearningCard key={item.enrollmentId} item={item} />
      ))}
    </div>
  );
}
