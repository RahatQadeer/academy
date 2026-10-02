export function CredentialIdentityCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <aside
      className="rounded-[10px] bg-surface p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <h3 className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {body}
      </p>
    </aside>
  );
}
