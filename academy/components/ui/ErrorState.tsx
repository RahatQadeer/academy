import { Callout } from "@/base/components/Callout";
import { RetryButton } from "./RetryButton";

/**
 * Every Academy load failure looks the same and always offers a way forward.
 * `body` defaults to the reassurance that nothing was changed by the failure.
 */
export function ErrorState({
  title,
  body = "Nothing has changed — try again.",
  retryLabel,
}: {
  title: string;
  body?: string;
  retryLabel?: string;
}) {
  return (
    <Callout tone="warning" title={title}>
      <p>{body}</p>
      <div className="mt-3">
        <RetryButton label={retryLabel} />
      </div>
    </Callout>
  );
}
