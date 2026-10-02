import { SubmitPlain } from "@/base/components/Submit";
import { Modal } from "@/whitbyos/components/Modal";
import { saveWidgets } from "@/whitbyos/actions";
import { WIDGETS } from "@/whitbyos/lib/widget-vocab";

/**
 * Screen 1.3 — which widgets are on Home.
 *
 * The export's list of seven, ticked where the widget is already there. It
 * closes on Done rather than Save because the switches are the whole dialog:
 * there is nothing to review before committing.
 */
export function WidgetsDialog({
  prefs,
  closeHref,
}: {
  prefs: Record<string, boolean>;
  closeHref: string;
}) {
  return (
    <Modal
      title="Dashboard Widgets"
      closeHref={closeHref}
      width={320}
      dense
      titleSize={14}
      headerGap={8}
      closeSize={13}
      scrim="rgba(55,53,47,.1)"
    >
      <form action={saveWidgets} className="flex flex-col gap-1">
        {WIDGETS.map((widget) => (
          <label
            key={widget.key}
            className="flex cursor-pointer items-center gap-2.5 px-1 py-2 text-[13px]"
          >
            <input
              type="checkbox"
              name={widget.key}
              defaultChecked={prefs[widget.key] !== false}
              className="h-[15px] w-[15px] shrink-0"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="flex-1">{widget.label}</span>
          </label>
        ))}

        <SubmitPlain
         
          className="mt-2 w-full rounded-control py-[7px] text-center text-[13px] font-medium text-white"
          style={{ background: "var(--accent)" }}
        >
          Done
        </SubmitPlain>
      </form>
    </Modal>
  );
}
