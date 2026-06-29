export const tacticalTabsListClasses =
  "gap-[0.2rem] rounded-md border border-border bg-card/50 p-[0.25rem] [backdrop-filter:blur(6px)]";

export const tacticalTabsTriggerClasses =
  "group gap-[0.45rem] font-sans text-[0.7rem] font-semibold uppercase tracking-[0.14em] transition-[color,background-color] duration-150 px-3 py-1.5 data-[state=active]:bg-[hsl(var(--tac-amber)/0.12)] data-[state=active]:text-foreground";

export const tacticalTabIndicatorClasses =
  "inline-block h-[7px] w-[7px] rotate-45 bg-[hsl(var(--muted-foreground)/0.5)] transition-colors duration-150";

export const tacticalTabIndicatorLiveClasses =
  "group-data-[state=active]:bg-destructive";

export const tacticalTabIndicatorUpcomingClasses =
  "group-data-[state=active]:bg-[hsl(var(--tac-amber))]";

export const tacticalTabIndicatorFinishedClasses =
  "group-data-[state=active]:bg-success";

export const tacticalSectionLabelClasses =
  "mb-1 inline-flex items-center gap-2 font-sans text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground";

export const tacticalSectionTickClasses =
  "inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";

export const tacticalSectionDescriptionClasses =
  "mb-3 text-[0.85rem] text-muted-foreground";

// Options-bar pattern (manage matches / manage tournaments): a bordered card
// holding compact popover-trigger buttons + removable chips. Shared so every
// list/filter page renders the exact same control bar.
export const filterTriggerBase =
  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] leading-none transition-colors duration-150 cursor-pointer";
export const filterTriggerIdle =
  "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground";
export const filterTriggerActive =
  "border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]";
export const filterBadgeClasses =
  "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[hsl(var(--tac-amber)/0.25)] px-1 font-sans text-[0.6rem] font-bold leading-none text-[hsl(var(--tac-amber))]";
// Inline selected-value shown next to a single-select trigger's label (e.g.
// KILLS · 3+ kills). leading-none keeps it vertically centered in the h-8 row.
export const filterTriggerValueClasses =
  "inline-flex items-center font-sans text-[0.6rem] font-bold leading-none normal-case tracking-normal text-[hsl(var(--tac-amber))]";

export const tacticalFilterPillClasses =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs tracking-[0.06em] text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground";

// Active overrides are marked important so they reliably beat the pill base's
// `border-border bg-muted/30 text-muted-foreground` regardless of Tailwind's
// utility source order (without `!`, amber/danger lost the border/bg conflict
// while warning happened to win).
export const tacticalFilterPillActiveClasses =
  "!border-[hsl(var(--tac-amber)/0.5)] !bg-[hsl(var(--tac-amber)/0.15)] !text-[hsl(var(--tac-amber))] hover:!bg-[hsl(var(--tac-amber)/0.22)]";

export const tacticalFilterPillActiveWarningClasses =
  "!border-[hsl(var(--warning)/0.55)] !bg-[hsl(var(--warning)/0.18)] !text-warning hover:!bg-[hsl(var(--warning)/0.25)]";

export const tacticalFilterPillActiveDangerClasses =
  "!border-[hsl(var(--destructive)/0.55)] !bg-[hsl(var(--destructive)/0.18)] !text-destructive hover:!bg-[hsl(var(--destructive)/0.25)]";

// Tactical amber CTA button — prominent create/action buttons.
// Matches the Play/Submit hero aesthetic. Background gradient + shadows live
// in .tac-amber-cta (assets/css/tailwind.css) because deeply nested
// Tailwind arbitrary gradient values were unreliable.
export const tacticalCtaButtonClasses =
  "tac-amber-cta relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-md border px-5 py-3 font-sans text-xs font-bold uppercase leading-none tracking-[0.16em] cursor-pointer";

// Header action buttons size their height to the page title's clamp so the
// header is governed by the title text (it scales with the title instead of
// jumping to a fixed button height). Pair with a
// `<breakpoint>:aspect-square <breakpoint>:!px-0` collapse on each page so the
// icon-only state is a square. Mirrors the title clamp in TacticalPageHeader.
export const tacticalHeaderActionClasses =
  "!py-0 h-[clamp(1.75rem,4.2vw,3rem)]";

// Tactical veto tile — rounded frame for map/region pick-ban tiles.
// Combine the base with hover + active + disabled as needed.
export const vetoTileClasses =
  "relative w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-card/40 [backdrop-filter:blur(6px)] transition-[border-color,transform,box-shadow,opacity,filter] duration-200";

export const vetoTileHoverClasses =
  "hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.45)]";

export const vetoTileActiveClasses =
  "border-[hsl(var(--tac-amber))] [box-shadow:0_0_0_3px_hsl(var(--tac-amber)_/_0.12),0_0_22px_hsl(var(--tac-amber)_/_0.35)]";

export const vetoTileDisabledClasses =
  "pointer-events-none grayscale opacity-30";

// Black overlay behind the confirm pill. `p-3` keeps the pill off the tile edges.
export const vetoTileConfirmOverlayClasses =
  "absolute inset-0 z-[3] flex cursor-pointer items-center justify-center p-3 bg-black/45 [backdrop-filter:blur(3px)]";

// Small tactical-amber confirm pill — reuses .tac-amber-cta gradient/shadow.
export const vetoTileConfirmPillClasses =
  "tac-amber-cta inline-flex items-center gap-1.5 rounded-md border px-3 py-2 font-sans text-[0.7rem] font-bold uppercase leading-none tracking-[0.18em]";
