import { Callout } from "@/base/components/Callout";

export function HomeLoadWarnings({ warnings }: { warnings?: string[] }) {
  if (!warnings?.length) return null;

  return (
    <div className="mb-5 space-y-2">
      {warnings.map((warning) => (
        <Callout key={warning} tone="warning">
          {warning}
        </Callout>
      ))}
    </div>
  );
}
