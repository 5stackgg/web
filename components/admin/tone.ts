// One colour per meaning on the admin pages. Use these maps, never raw
// amber-*/yellow-* utilities:
//   ok    --success      healthy, running as it should
//   warn  --warning      degraded or needs a look soon (high load, short pool,
//                        outdated build)
//   bad   --destructive  broken, offline, failed
//   info  --info         a neutral state worth noticing (setting up, queued)
//   off   muted          disabled, unknown, no data
//   amber --tac-amber    the brand accent and "attention / your turn" (the
//                        selected row, an active control, a step waiting on
//                        you). Never a warning.
// Pair a tone with an icon or a word; colour alone never carries the meaning.
//
// Lives in components/ rather than utilities/ because Tailwind's content scan
// skips utilities/: a class that only appears there never generates.

export type Tone = "ok" | "warn" | "bad" | "info" | "off" | "amber";

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
  info: "text-info",
  off: "text-muted-foreground",
  amber: "text-[hsl(var(--tac-amber))]",
};

export const TONE_BG: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  info: "bg-info",
  off: "bg-muted-foreground/40",
  amber: "bg-[hsl(var(--tac-amber))]",
};

export const TONE_BORDER: Record<Tone, string> = {
  ok: "border-success/35",
  warn: "border-warning/35",
  bad: "border-destructive/40",
  info: "border-info/35",
  off: "border-border",
  amber: "border-[hsl(var(--tac-amber)/0.35)]",
};
