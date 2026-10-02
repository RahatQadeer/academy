export function DocumentPreview({
  previewUrl,
  kind,
  appPath,
}: {
  previewUrl: string | null;
  kind: "pdf" | "image" | "other";
  /** In-app agreement / non-file document (§17.13.4). */
  appPath?: string | null;
}) {
  if (appPath) {
    return (
      <div
        className="flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-[10px] bg-white px-6 text-center text-[13.5px]"
        style={{
          border: "1px solid var(--border)",
          color: "rgba(55,53,47,.55)",
        }}
      >
        <div>Accepted Partner Agreement</div>
        <a
          href={appPath}
          className="font-semibold no-underline"
          style={{ color: "var(--accent)" }}
        >
          View agreement text →
        </a>
      </div>
    );
  }

  if (!previewUrl || kind === "other") {
    return (
      <div
        className="flex min-h-[480px] items-center justify-center rounded-[10px] bg-white text-[13.5px]"
        style={{
          border: "1px solid var(--border)",
          color: "rgba(55,53,47,.35)",
        }}
      >
        {!previewUrl
          ? "Document preview"
          : "Preview isn’t available — download the file"}
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        title="Document preview"
        src={previewUrl}
        className="min-h-[480px] w-full rounded-[10px] bg-white"
        style={{ border: "1px solid var(--border)" }}
      />
    );
  }

  return (
    <div
      className="flex min-h-[480px] items-center justify-center rounded-[10px] bg-white p-6"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="Document preview"
        className="max-h-[440px] max-w-full object-contain"
      />
    </div>
  );
}
