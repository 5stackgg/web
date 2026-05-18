export function kdrColor(kd: number): string {
  if (kd >= 1.2) return "text-[hsl(var(--success))]";
  if (kd < 0.85) return "text-destructive";
  return "";
}

export function kdrStrokeColor(kd: number): string {
  if (kd >= 1.2) return "hsl(142, 76%, 36%)"; // --success
  if (kd < 0.85) return "hsl(0, 84%, 60%)"; // --destructive
  return "hsl(0, 0%, 70%)";
}
