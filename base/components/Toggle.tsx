"use client";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
  checkedColor?: string;
};

export function Toggle({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  checkedColor = "var(--accent)",
}: ToggleProps) {
  const switchId = id ?? "keep-signed-in";

  return (
    <label
      htmlFor={switchId}
      className="flex min-w-0 items-center gap-3"
      style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
    >
      <input
        id={switchId}
        type="checkbox"
        role="switch"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center"
        style={{
          boxSizing: "border-box",
          width: 34,
          minWidth: 34,
          height: 20,
          padding: 2,
          borderRadius: 10,
          background: checked ? checkedColor : "#e0e0dd",
          justifyContent: checked ? "flex-end" : "flex-start",
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#fff",
            boxShadow: "0 1px 2px rgba(15,15,15,.16)",
            display: "block",
            flexShrink: 0,
          }}
        />
      </span>
      {label ? (
        <span
          className="select-none text-[14px] leading-none"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </span>
      ) : null}
    </label>
  );
}
