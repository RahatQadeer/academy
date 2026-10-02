import { Pill } from "@/base/components/Pill";
import { updateCategoryTone } from "@/client-portal/lib/vocab";

/**
 * A form's or an update's category, drawn as the same pill every other label in
 * the portal uses. The text is WhitbyOS's own word for it, never a translation.
 */
export function CategoryTag({ category }: { category: string }) {
  return <Pill tone={updateCategoryTone(category)}>{category}</Pill>;
}
