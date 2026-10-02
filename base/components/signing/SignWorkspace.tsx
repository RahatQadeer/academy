"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { cn } from "@/base/lib/cn";
import type { PlacementKind } from "@/base/lib/signing/placement";
import { PdfPages, type PageSize } from "./PdfPages";
import {
  SIGNATURE_FACES,
  drawDate,
  drawSignature,
  todayLabel,
  type Stamp,
} from "./stamps";

/**
 * What signing hands to the product it is in. Both answer with the problem, or
 * redirect on success — the screen keeps everything placed while it shows why
 * a signature was refused.
 *
 * Each receives a FormData carrying `documentId` and `note`; `sign` also gets
 * `name`, `placements`, and the `signature` / `date` PNGs, and `upload` gets
 * `file`.
 */
export type SigningResult = { error: string } | void;
export type SigningAction = (form: FormData) => Promise<SigningResult>;

/** A form's control height and type, the one size every button here uses. */
const FORM_BUTTON = "px-[18px] py-[9px] text-[13.5px]";

type Placed = {
  id: string;
  page: number;
  kind: PlacementKind;
  /** Fractions of the page, top-left origin. Height follows from the stamp. */
  x: number;
  y: number;
  w: number;
};

type Drag =
  | {
      mode: "place" | "move";
      kind: PlacementKind;
      placedId: string | null;
      startX: number;
      startY: number;
      pointerX: number;
      pointerY: number;
      /** Where in the stamp it was picked up, in pixels. */
      grabX: number;
      grabY: number;
      widthPx: number;
      moved: boolean;
    }
  | {
      mode: "resize";
      placedId: string;
      startX: number;
      startW: number;
      pageWidth: number;
    };

/** How wide a stamp lands, as a share of the page — a signature line's worth. */
const DEFAULT_WIDTH: Record<PlacementKind, number> = { signature: 0.3, date: 0.16 };
const MIN_WIDTH = 0.06;
/** A press that moves less than this is a click, not a drag. */
const DRAG_SLOP = 4;

let counter = 0;
const nextId = () => `p${(counter += 1)}`;

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Signing a document in the portal.
 *
 * The document on the right, as it will be filed. On the left, the signature:
 * the client types their name, picks how it is drawn, and drags it onto the
 * page wherever it has to go — as many times as the document asks, with the
 * date beside it if the form has a line for one. Placed stamps move, resize and
 * come off again. Nothing is filed until Finish, and then the server stamps the
 * firm's own PDF with exactly what was placed.
 *
 * "Sign on paper" is the same ask answered the other way: download, sign with
 * a pen, upload the signed copy. It is the only way offered when the document
 * is not a PDF, and one tab away when it is — some people would rather.
 *
 * Both sides sign here — the client in the Portal, the professional in
 * WhitbyOS. Each passes its own actions and says who the signed copy goes to;
 * the screen itself is the same, so signing reads the same from either end.
 */
export function SignWorkspace({
  documentId,
  title,
  eyebrow,
  recipient,
  pdfUrl,
  downloadUrl,
  defaultName,
  closeHref,
  signAction,
  uploadAction,
  declineAction,
  paperExtra,
  notice,
}: {
  documentId: string;
  title: string;
  /** The line above the title: who is asking. */
  eyebrow: string;
  /** Who receives the signed copy — "your team", "the client". */
  recipient: string;
  /** Null when this document cannot be signed on screen. */
  pdfUrl: string | null;
  downloadUrl: string | null;
  defaultName: string;
  closeHref: string;
  signAction: SigningAction;
  uploadAction: SigningAction;
  /** Omitted when there is nobody to decline to — nobody asked. */
  declineAction?: (form: FormData) => Promise<void>;
  /** Anything a product adds under the paper upload. */
  paperExtra?: ReactNode;
  /** A problem reported by a redirect rather than by an action's answer. */
  notice?: string;
}) {
  const [method, setMethod] = useState<"screen" | "paper">(pdfUrl ? "screen" : "paper");
  const [declining, setDeclining] = useState(false);

  // Nothing behind the screen should scroll while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Sign ${title}`}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--surface-soft)" }}
    >
      <header
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-surface px-4 py-3 sm:px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {eyebrow}
          </p>
          <h2 className="truncate text-[15.5px] font-semibold">{title}</h2>
        </div>

        <div
          role="tablist"
          aria-label="How to sign"
          className="inline-flex rounded-control border border-line-strong p-0.5"
        >
          {(
            [
              ["screen", "Sign here"],
              ["paper", "Sign on paper"],
            ] as const
          ).map(([key, label]) => {
            const unavailable = key === "screen" && !pdfUrl;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={method === key}
                disabled={unavailable}
                title={unavailable ? "Only a PDF can be signed on screen" : undefined}
                onClick={() => setMethod(key)}
                className={cn(
                  "rounded-[5px] px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  method === key ? "bg-[var(--ink)] text-white" : "hover:bg-[var(--surface-soft)]",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <Link
          href={closeHref}
          aria-label="Close"
          className="inline-flex h-8 w-8 items-center justify-center rounded-control text-[18px] no-underline hover:bg-[var(--surface-soft)]"
          style={{ color: "var(--text-tertiary)" }}
        >
          ×
        </Link>
      </header>

      {notice ? (
        <p
          role="alert"
          className="border-b px-4 py-2.5 text-[12.5px] sm:px-6"
          style={{ borderColor: "var(--border)", color: "var(--danger-text)", background: "var(--surface)" }}
        >
          {notice}
        </p>
      ) : null}

      {declining && declineAction ? (
        <DeclinePane
          documentId={documentId}
          action={declineAction}
          onBack={() => setDeclining(false)}
        />
      ) : method === "screen" && pdfUrl ? (
        <ScreenSigning
          documentId={documentId}
          pdfUrl={pdfUrl}
          defaultName={defaultName}
          recipient={recipient}
          action={signAction}
          onDecline={declineAction ? () => setDeclining(true) : undefined}
        />
      ) : (
        <PaperSigning
          documentId={documentId}
          downloadUrl={downloadUrl}
          onScreenAvailable={Boolean(pdfUrl)}
          recipient={recipient}
          action={uploadAction}
          extra={paperExtra}
          onDecline={declineAction ? () => setDeclining(true) : undefined}
        />
      )}
    </div>
  );
}

function ScreenSigning({
  documentId,
  pdfUrl,
  defaultName,
  recipient,
  action,
  onDecline,
}: {
  documentId: string;
  pdfUrl: string;
  defaultName: string;
  recipient: string;
  action: SigningAction;
  onDecline?: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [faceId, setFaceId] = useState(SIGNATURE_FACES[0].id);
  const [note, setNote] = useState("");
  const [stamps, setStamps] = useState<Partial<Record<PlacementKind, Stamp>>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<PageSize[]>([]);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [armed, setArmed] = useState<PlacementKind | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  // The window listeners outlive a render, so they read these rather than
  // closing over values that are stale by the second pointermove.
  const placedRef = useRef(placed);
  placedRef.current = placed;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const stampsRef = useRef(stamps);
  stampsRef.current = stamps;

  const face = SIGNATURE_FACES.find((one) => one.id === faceId) ?? SIGNATURE_FACES[0];
  const trimmed = name.trim();

  // The signature, redrawn as the name is typed; the date, once.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const signature = trimmed ? await drawSignature(trimmed, face) : null;
      if (cancelled) return;
      setStamps((current) => {
        if (current.signature) URL.revokeObjectURL(current.signature.url);
        return { ...current, signature: signature ?? undefined };
      });
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, face]);

  useEffect(() => {
    let cancelled = false;
    void drawDate(todayLabel()).then((date) => {
      if (!cancelled && date) setStamps((current) => ({ ...current, date }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One small picture per face, so the choice is made by looking.
  useEffect(() => {
    let cancelled = false;
    const sample = trimmed || "Your Name";
    const timer = setTimeout(async () => {
      const drawn: Record<string, string> = {};
      for (const one of SIGNATURE_FACES) {
        const stamp = await drawSignature(sample, one);
        if (stamp) drawn[one.id] = stamp.url;
      }
      if (cancelled) {
        Object.values(drawn).forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setPreviews((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        return drawn;
      });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const onPages = useCallback((sizes: PageSize[]) => setPages(sizes), []);

  /** The height of a placed stamp, as a share of its page. */
  const heightOf = useCallback(
    (item: Pick<Placed, "kind" | "page" | "w">) => {
      const stamp = stamps[item.kind];
      const size = pages[item.page];
      if (!stamp || !size) return 0;
      return (item.w * size.width) / stamp.aspect / size.height;
    },
    [stamps, pages],
  );

  /** Put a stamp down with its top-left at a point on screen. */
  const dropAt = useCallback(
    (kind: PlacementKind, left: number, top: number, pointerX: number, pointerY: number, placedId: string | null, width: number | null) => {
      const index = pageRefs.current.findIndex((element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return (
          pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom
        );
      });
      if (index < 0) return false;

      const rect = pageRefs.current[index]!.getBoundingClientRect();
      const w = clamp(width ?? DEFAULT_WIDTH[kind], MIN_WIDTH, 1);
      const h = heightOf({ kind, page: index, w });
      const x = clamp((left - rect.left) / rect.width, 0, 1 - w);
      const y = clamp((top - rect.top) / rect.height, 0, Math.max(0, 1 - h));

      if (placedId) {
        setPlaced((current) =>
          current.map((item) => (item.id === placedId ? { ...item, page: index, x, y, w } : item)),
        );
        setSelected(placedId);
      } else {
        const id = nextId();
        setPlaced((current) => [...current, { id, page: index, kind, x, y, w }]);
        setSelected(id);
      }
      setError(null);
      return true;
    },
    [heightOf],
  );

  // One set of window listeners for every kind of drag, so a drag that leaves
  // the page or the window still ends.
  useEffect(() => {
    if (!drag) return;

    function onMove(event: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      if (current.mode === "resize") {
        const item = placedRef.current.find((one) => one.id === current.placedId);
        if (!item) return;
        const w = clamp(current.startW + (event.clientX - current.startX) / current.pageWidth, MIN_WIDTH, 1 - item.x);
        const size = pagesRef.current[item.page];
        const stamp = stampsRef.current[item.kind];
        // Grow no further than the bottom of the page.
        const maxW =
          size && stamp ? ((1 - item.y) * size.height * stamp.aspect) / size.width : 1;
        const bounded = Math.min(w, maxW);
        setPlaced((all) => all.map((one) => (one.id === item.id ? { ...one, w: bounded } : one)));
        return;
      }
      const moved =
        current.moved ||
        Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > DRAG_SLOP;
      setDrag({ ...current, pointerX: event.clientX, pointerY: event.clientY, moved });
    }

    function onUp(event: PointerEvent) {
      const current = dragRef.current;
      setDrag(null);
      if (!current || current.mode === "resize") return;

      if (!current.moved) {
        // A click. On the panel it picks the stamp up to be put down with the
        // next click on a page; on the page it selects what was clicked.
        if (current.mode === "place") setArmed((was) => (was === current.kind ? null : current.kind));
        else setSelected(current.placedId);
        return;
      }

      const item = current.placedId
        ? placedRef.current.find((one) => one.id === current.placedId)
        : null;
      dropAt(
        current.kind,
        event.clientX - current.grabX,
        event.clientY - current.grabY,
        event.clientX,
        event.clientY,
        current.placedId,
        item?.w ?? null,
      );
      setArmed(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // Only whether a drag is running matters; its detail is read from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(drag), dropAt]);

  function pickUp(kind: PlacementKind, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || !stamps[kind]) return;
    event.preventDefault();
    const pageWidth = pages[0]?.width ?? 600;
    const widthPx = DEFAULT_WIDTH[kind] * pageWidth;
    const heightPx = widthPx / stamps[kind]!.aspect;
    setDrag({
      mode: "place",
      kind,
      placedId: null,
      startX: event.clientX,
      startY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      grabX: widthPx / 2,
      grabY: heightPx / 2,
      widthPx,
      moved: false,
    });
  }

  function pickUpPlaced(item: Placed, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setDrag({
      mode: "move",
      kind: item.kind,
      placedId: item.id,
      startX: event.clientX,
      startY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      widthPx: rect.width,
      moved: false,
    });
  }

  function startResize(item: Placed, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setSelected(item.id);
    setDrag({
      mode: "resize",
      placedId: item.id,
      startX: event.clientX,
      startW: item.w,
      pageWidth: pages[item.page]?.width ?? 600,
    });
  }

  function remove(id: string) {
    setPlaced((current) => current.filter((item) => item.id !== id));
    setSelected((current) => (current === id ? null : current));
  }

  function nudge(item: Placed, event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(item.id);
      return;
    }
    const step = event.shiftKey ? 0.02 : 0.004;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const h = heightOf(item);
    setPlaced((current) =>
      current.map((one) =>
        one.id === item.id
          ? {
              ...one,
              x: clamp(one.x + move[0], 0, 1 - one.w),
              y: clamp(one.y + move[1], 0, Math.max(0, 1 - h)),
            }
          : one,
      ),
    );
  }

  function placeWithClick(page: number, event: React.MouseEvent<HTMLDivElement>) {
    if (!armed) {
      setSelected(null);
      return;
    }
    const stamp = stamps[armed];
    const size = pages[page];
    if (!stamp || !size) return;
    const widthPx = DEFAULT_WIDTH[armed] * size.width;
    const heightPx = widthPx / stamp.aspect;
    dropAt(
      armed,
      event.clientX - widthPx / 2,
      event.clientY - heightPx / 2,
      event.clientX,
      event.clientY,
      null,
      null,
    );
    setArmed(null);
  }

  // A signature placed and then changed by retyping the name keeps its width,
  // so its height changes with it; anything pushed past the bottom edge by
  // that comes back up.
  useEffect(() => {
    setPlaced((current) => {
      let changed = false;
      const next = current.map((item) => {
        const h = heightOf(item);
        if (item.y + h <= 1) return item;
        changed = true;
        return { ...item, y: Math.max(0, 1 - h) };
      });
      return changed ? next : current;
    });
  }, [heightOf]);

  const signatures = placed.filter((item) => item.kind === "signature").length;

  function finish() {
    setError(null);
    if (!trimmed) return setError("Type your name to make your signature.");
    if (signatures === 0) return setError("Drag your signature onto the document first.");
    const signature = stamps.signature;
    if (!signature) return setError("Your signature is still being drawn. Try again in a moment.");

    const form = new FormData();
    form.set("documentId", documentId);
    form.set("name", trimmed);
    form.set("note", note);
    form.set(
      "placements",
      JSON.stringify(
        placed.map((item) => ({
          page: item.page,
          kind: item.kind,
          x: item.x,
          y: item.y,
          w: item.w,
          h: heightOf(item),
        })),
      ),
    );
    form.set("signature", new File([signature.blob], "signature.png", { type: "image/png" }));
    if (placed.some((item) => item.kind === "date") && stamps.date) {
      form.set("date", new File([stamps.date.blob], "date.png", { type: "image/png" }));
    }

    startTransition(async () => {
      const result = await action(form);
      if (result && "error" in result) setError(result.error);
    });
  }

  const ghost = drag && drag.mode !== "resize" && drag.moved ? drag : null;
  const ghostStamp = ghost ? stamps[ghost.kind] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* The signature, and what to do with it. */}
      <aside
        className="flex max-h-[46vh] shrink-0 flex-col gap-5 overflow-y-auto border-b bg-surface px-4 py-5 md:max-h-none md:w-[330px] md:border-b-0 md:border-r md:px-5"
        style={{ borderColor: "var(--border)" }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            Your full name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoComplete="name"
            placeholder="Type your name"
            className="w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px] outline-none focus:border-accent"
          />
        </label>

        <fieldset>
          <legend className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            Style
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {SIGNATURE_FACES.map((one) => (
              <button
                key={one.id}
                type="button"
                aria-pressed={one.id === faceId}
                aria-label={one.label}
                onClick={() => setFaceId(one.id)}
                className={cn(
                  "flex h-[52px] items-center justify-center rounded-control border px-2 transition-colors",
                  one.id === faceId
                    ? "border-accent bg-[var(--surface-soft)]"
                    : "border-line-strong hover:bg-[var(--surface-soft)]",
                )}
              >
                {previews[one.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[one.id]} alt="" className="max-h-[34px] max-w-full object-contain" draggable={false} />
                ) : null}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            Drag onto the document
          </p>
          <div className="flex flex-col gap-2">
            <StampChip
              label="Signature"
              stamp={stamps.signature}
              armed={armed === "signature"}
              onPointerDown={(event) => pickUp("signature", event)}
              empty="Type your name above"
            />
            <StampChip
              label="Date"
              stamp={stamps.date}
              armed={armed === "date"}
              onPointerDown={(event) => pickUp("date", event)}
              compact
            />
          </div>
          <p className="mt-2 text-[12px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
            {armed
              ? "Now click the spot on the page where it goes."
              : "Drag it to the line where you sign, or click it and then click the page. Place it as many times as the document needs."}
          </p>
        </div>

        <div
          className="rounded-control px-3 py-2.5 text-[12.5px]"
          style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}
          aria-live="polite"
        >
          {placed.length === 0
            ? "Nothing placed yet."
            : `${signatures} ${signatures === 1 ? "signature" : "signatures"}${
                placed.length > signatures ? ` and ${placed.length - signatures} date${placed.length - signatures === 1 ? "" : "s"}` : ""
              } placed. Select one to move it with the arrow keys or remove it.`}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            Note to {recipient} <span style={{ color: "var(--text-quiet)" }}>(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={600}
            className="w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px]"
          />
        </label>

        {error ? (
          <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger-text)" }}>
            {error}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Button
            variant="primary"
            unsized
            className={FORM_BUTTON}
            disabled={pending || signatures === 0}
            onClick={finish}
          >
            {pending ? "Signing…" : "Finish and send"}
          </Button>
          <p className="text-[11.5px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
            By finishing, you agree that this typed signature is your signature on
            this document. {capitalise(recipient)} gets the signed copy; the
            original is kept.
          </p>
          {onDecline ? (
            <button
              type="button"
              onClick={onDecline}
              className="self-start text-[12.5px] underline-offset-2 hover:underline"
              style={{ color: "var(--text-tertiary)" }}
            >
              Decline to sign
            </button>
          ) : null}
        </div>
      </aside>

      {/* The document. */}
      <div className="min-h-0 flex-1 overflow-auto px-3 py-6 sm:px-6">
        <PdfPages
          url={pdfUrl}
          pageRefs={pageRefs}
          onPages={onPages}
          armed={Boolean(armed)}
          onPageClick={placeWithClick}
          renderOverlay={(page) =>
            placed
              .filter((item) => item.page === page)
              .map((item) => {
                const stamp = stamps[item.kind];
                if (!stamp) return null;
                const isSelected = selected === item.id;
                const isMoving = drag?.mode === "move" && drag.placedId === item.id && drag.moved;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.kind === "signature" ? "Signature" : "Date"} on page ${page + 1}. Arrow keys move it, Delete removes it.`}
                    onPointerDown={(event) => pickUpPlaced(item, event)}
                    onClick={(event) => event.stopPropagation()}
                    onFocus={() => setSelected(item.id)}
                    onKeyDown={(event) => nudge(item, event)}
                    className={cn(
                      "group absolute cursor-grab touch-none select-none rounded-[3px] outline-none",
                      isSelected
                        ? "ring-2 ring-[var(--accent)]"
                        : "ring-1 ring-transparent hover:ring-[var(--accent)]",
                    )}
                    style={{
                      left: `${item.x * 100}%`,
                      top: `${item.y * 100}%`,
                      width: `${item.w * 100}%`,
                      aspectRatio: String(stamp.aspect),
                      opacity: isMoving ? 0.25 : 1,
                      background: isSelected ? "var(--accent-tint-soft)" : undefined,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stamp.url} alt="" draggable={false} className="pointer-events-none h-full w-full" />
                    {isSelected ? (
                      <>
                        <button
                          type="button"
                          aria-label="Remove"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            remove(item.id);
                          }}
                          className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ink)] text-[12px] leading-none text-white shadow"
                        >
                          ×
                        </button>
                        <span
                          aria-hidden
                          onPointerDown={(event) => startResize(item, event)}
                          className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-[2px] border-2 border-white bg-[var(--accent)] shadow"
                        />
                      </>
                    ) : null}
                  </div>
                );
              })
          }
        />
      </div>

      {/* What is being dragged, following the pointer at the size it will land. */}
      {ghost && ghostStamp ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ghostStamp.url}
          alt=""
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-[3px] ring-2 ring-[var(--accent)]"
          style={{
            left: ghost.pointerX - ghost.grabX,
            top: ghost.pointerY - ghost.grabY,
            width: ghost.widthPx,
            background: "rgba(255,255,255,.7)",
          }}
        />
      ) : null}
    </div>
  );
}

function StampChip({
  label,
  stamp,
  armed,
  onPointerDown,
  empty,
  compact,
}: {
  label: string;
  stamp: Stamp | undefined;
  armed: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  empty?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={stamp ? 0 : -1}
      aria-disabled={!stamp}
      aria-pressed={armed}
      aria-label={`${label}: drag onto the document, or press and then click the page`}
      onPointerDown={onPointerDown}
      className={cn(
        "flex touch-none select-none items-center gap-3 rounded-control border border-dashed px-3 transition-colors",
        compact ? "h-[44px]" : "h-[72px]",
        stamp ? "cursor-grab hover:bg-[var(--surface-soft)]" : "cursor-not-allowed opacity-60",
        armed ? "border-accent bg-[var(--surface-soft)]" : "border-line-strong",
      )}
    >
      <span
        aria-hidden
        className="shrink-0 text-[14px] leading-none"
        style={{ color: "var(--text-quiet)" }}
      >
        ⠿
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-center">
        {stamp ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stamp.url}
            alt=""
            draggable={false}
            className={cn("pointer-events-none max-w-full object-contain", compact ? "max-h-[22px]" : "max-h-[50px]")}
          />
        ) : (
          <span className="text-[12.5px]" style={{ color: "var(--text-quiet)" }}>
            {empty}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-quiet)" }}>
        {label}
      </span>
    </div>
  );
}

function PaperSigning({
  documentId,
  downloadUrl,
  onScreenAvailable,
  recipient,
  action,
  extra,
  onDecline,
}: {
  documentId: string;
  downloadUrl: string | null;
  onScreenAvailable: boolean;
  recipient: string;
  action: SigningAction;
  extra?: ReactNode;
  onDecline?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action(form);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8">
      <div className="mx-auto max-w-[520px] rounded-card bg-surface p-8 shadow-[0_1px_3px_rgba(15,15,15,.08)]">
        {!onScreenAvailable ? (
          <p
            className="mb-5 rounded-control px-3 py-2.5 text-[12.5px]"
            style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}
          >
            This document is not a PDF, so it cannot be signed on screen. Sign it
            on paper and send the signed copy back here.
          </p>
        ) : null}

        <ol className="flex flex-col gap-6">
          <li>
            <Step number={1} title="Download the document">
              Print it, or open it in any app you sign documents with.
            </Step>
            {downloadUrl ? (
              <a
                href={downloadUrl}
                className={cn(
                  "ml-9 mt-3 inline-flex items-center justify-center rounded-control border border-line-strong font-medium no-underline hover:bg-[var(--surface-soft)]",
                  FORM_BUTTON,
                )}
              >
                Download
              </a>
            ) : (
              <p className="ml-9 mt-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                The file could not be fetched just now. Close this and try again.
              </p>
            )}
          </li>
          <li>
            <Step number={2} title="Sign it">
              In ink, then scan it or take a clear photo of every signed page.
            </Step>
          </li>
          <li>
            <Step number={3} title="Upload the signed copy">
              A PDF, a photo (PNG or JPG), or a Word file, up to 25 MB.
            </Step>
            <form onSubmit={submit} className="ml-9 mt-3 flex flex-col gap-3">
              <input type="hidden" name="documentId" value={documentId} />
              <input
                type="file"
                name="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg"
                className="w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px] file:mr-3 file:rounded-control file:border-0 file:bg-surface-soft file:px-3 file:py-1.5 file:text-[13px]"
              />
              <textarea
                name="note"
                rows={2}
                maxLength={600}
                placeholder={`Note to ${recipient} (optional)`}
                className="w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px]"
              />
              {error ? (
                <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger-text)" }}>
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                {onDecline ? (
                  <button
                    type="button"
                    onClick={onDecline}
                    className="text-[12.5px] underline-offset-2 hover:underline"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Decline to sign
                  </button>
                ) : (
                  <span />
                )}
                <Button type="submit" variant="primary" unsized className={FORM_BUTTON} disabled={pending}>
                  {pending ? "Uploading…" : "Send signed copy"}
                </Button>
              </div>
            </form>
          </li>
        </ol>
        {extra ? (
          <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border)" }}>
            {extra}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
        style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}
      >
        {number}
      </span>
      <div>
        <p className="text-[14px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {children}
        </p>
      </div>
    </div>
  );
}

function DeclinePane({
  documentId,
  action,
  onBack,
}: {
  documentId: string;
  action: (form: FormData) => Promise<void>;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8">
      <form
        action={action}
        className="mx-auto max-w-[520px] rounded-card bg-surface p-8 shadow-[0_1px_3px_rgba(15,15,15,.08)]"
      >
        <input type="hidden" name="documentId" value={documentId} />
        <h3 className="text-[15px] font-semibold">Decline to sign</h3>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Say what needs to change, so they know what to send you next.
        </p>
        <textarea
          name="note"
          rows={4}
          maxLength={600}
          autoFocus
          className="mt-4 w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px]"
        />
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" unsized className={FORM_BUTTON} onClick={onBack}>
            Back
          </Button>
          <Submit variant="primary" unsized className={FORM_BUTTON}>
            Decline
          </Submit>
        </div>
      </form>
    </div>
  );
}
