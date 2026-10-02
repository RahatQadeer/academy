/**
 * Compact search + select row above a list table.
 *
 * Plain GET form, so filtering works server-side. Base `Input` isn't used here
 * — it renders a labelled form field, and this bar is unlabelled by design.
 *
 * No Apply button: none of the references draw one, and a select applies itself
 * (see `FilterSelect`). The search box submits on Enter, the way a one-field
 * form always has.
 */

import { FilterSelect } from "@/whitbyos/components/FilterSelect";
import { LiveSearch } from "@/whitbyos/components/LiveSearch";
import { SearchField } from "@/whitbyos/components/SearchField";

export type SelectFilter = {
  name: string;
  /** Shown when nothing is selected, e.g. "All types". */
  anyLabel: string;
  value?: string;
  options: { value: string; label: string }[];
};

export function FilterBar({
  action,
  searchName = "q",
  searchPlaceholder,
  searchValue,
  selects = [],
  sort,
  hidden,
  trailing,
}: {
  action: string;
  searchName?: string;
  searchPlaceholder: string;
  searchValue?: string;
  selects?: SelectFilter[];
  /** Always-on sort control. Empty value is the default labelled in `anyLabel`. */
  sort?: SelectFilter;
  hidden?: Record<string, string | undefined>;
  trailing?: React.ReactNode;
}) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-center gap-2.5">
      {hidden
        ? Object.entries(hidden).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )
        : null}

      {/* One search box for the twelve screens this bar draws. It was a bare
          bordered field, so the only thing saying it was a search was a
          placeholder that vanishes the moment anybody types in it. */}
      <SearchField
        name={searchName}
        defaultValue={searchValue}
        placeholder={searchPlaceholder}
        label={searchPlaceholder}
        className="w-[260px]"
      />

      {/* Narrows as you type. See `LiveSearch` — the form still does the
          searching, it just no longer waits to be told to. */}
      <LiveSearch name={searchName} />

      {selects.map((select) => (
        <FilterSelect
          key={select.name}
          name={select.name}
          value={select.value ?? ""}
          all={select.anyLabel}
          options={select.options}
        />
      ))}

      {sort ? (
        <span className="ml-auto">
          <FilterSelect
            name={sort.name}
            value={sort.value ?? ""}
            all={sort.anyLabel}
            options={sort.options}
          />
        </span>
      ) : null}

      {trailing}
    </form>
  );
}
