import { Input } from "@/base/components/Input";
import type { EditorModule } from "../types";
import { TITLE_MAX } from "../utils/validation";

export function ModuleEditor({
  module,
  disabled,
  onChangeTitle,
}: {
  module: EditorModule;
  disabled?: boolean;
  onChangeTitle: (title: string) => void;
}) {
  return (
    <Input
      label="Module title"
      name="module-title"
      value={module.title}
      maxLength={TITLE_MAX}
      disabled={disabled}
      onChange={(event) => onChangeTitle(event.target.value)}
    />
  );
}
