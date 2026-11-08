import type { DietFilter as Diet } from "../lib/diet";
import { FilterGroup, Segment } from "./FilterGroup";

/** All / Veg / Non-veg as links, so the choice lives in the URL and works without JS. */
export function DietFilter({ current, href }: { current?: Diet; href: (diet?: Diet) => string }) {
  return (
    <FilterGroup label="Diet">
      <Segment href={href()} active={!current}>
        All
      </Segment>
      <Segment href={href("veg")} active={current === "veg"}>
        Veg
      </Segment>
      <Segment href={href("non-veg")} active={current === "non-veg"}>
        Non-veg
      </Segment>
    </FilterGroup>
  );
}
