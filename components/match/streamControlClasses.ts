// Player controls over a live game picture. Frosted glass rather than a
// gradient scrim: a scrim dims the HUD's scorebar and kill feed under it.
// Sizes come from --stream-control and --stream-control-icon, which
// WhepPlayer sets from the player's width (and StreamGlobal sets for its own
// corner buttons).
export const streamControlBarClasses =
  "pointer-events-auto flex items-center gap-0.5 rounded-[calc(var(--stream-control)/4)] bg-background/50 p-[3px] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.24),inset_0_1px_0_rgb(255_255_255/0.1),0_10px_30px_-10px_rgb(0_0_0/0.9)] backdrop-blur-[14px] backdrop-saturate-[1.4]";

export const streamControlButtonClasses =
  "inline-flex h-[var(--stream-control)] min-w-[var(--stream-control)] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-[13px] font-semibold text-white transition-colors duration-150 ease-out hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

export const streamControlIconClasses =
  "size-[var(--stream-control-icon)] shrink-0";

// first:hidden covers a bar whose fullscreen button is gone (HLS fallback).
export const streamControlDividerClasses =
  "mx-[3px] h-[calc(var(--stream-control)/2)] w-px shrink-0 bg-white/[0.28] first:hidden";
