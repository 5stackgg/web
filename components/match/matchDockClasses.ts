// Dock controls share the admin bar's chip shape so the strip stays one short
// row; the tone says what the button does.
export const dockChip =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] transition-colors duration-200 ease-out disabled:pointer-events-none disabled:opacity-50";
export const dockPrimary = `${dockChip} border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)]`;
export const dockDanger = `${dockChip} border-[hsl(var(--destructive)/0.45)] text-destructive hover:bg-[hsl(var(--destructive)/0.12)]`;
export const dockNeutral = `${dockChip} border-border bg-background/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.4)] hover:text-foreground data-[state=open]:border-[hsl(var(--tac-amber)/0.4)] data-[state=open]:text-foreground`;
