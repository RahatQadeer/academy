import { Callout } from "@/base/components/Callout";
import type { ProductKey } from "@/base/types";
import { getProduct } from "@/base/switcher/products";

export function ModulePlaceholder({ product }: { product: ProductKey }) {
  const meta = getProduct(product);
  const eyebrow =
    product === "partner_center"
      ? "Private Attaché / Partner Center"
      : product === "client_portal"
        ? "Client Portal"
        : meta.name;

  return (
    <div className="px-8 py-10">
      <p
        className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {eyebrow}
      </p>
      <h1 className="text-[28px] font-bold tracking-[-0.4px]">{meta.comingSoon}</h1>
      <p className="mt-2 max-w-xl text-[15px]" style={{ color: "var(--text-secondary)" }}>
        Shared auth, identity, and the product switcher live in <code>/base</code>. Build this
        product in <code>/{folderName(product)}</code>, replace this placeholder when you
        start.
      </p>
      <div className="mt-6 max-w-xl">
        <Callout>
          Use the workspace name in the upper left to switch between Whitby, Client Portal, Academy,
          and Partner Center.
        </Callout>
      </div>
    </div>
  );
}

function folderName(product: ProductKey) {
  if (product === "whitbyos") return "whitbyos";
  if (product === "client_portal") return "client-portal";
  if (product === "partner_center") return "partner-center";
  return "academy";
}
