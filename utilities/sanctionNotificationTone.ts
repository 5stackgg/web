export type SanctionTone = "ban" | "warning";

type ToneSource = {
  type: string;
  role?: string | null;
  steam_id?: string | null;
  entity_id?: string | null;
};

// The co-player notice also goes out for mutes and gags on api builds without
// the ban-only change, so only the admin alert and the banned player's own
// notice are certainly bans.
export function sanctionNotificationTone(
  notification: ToneSource,
): SanctionTone | null {
  const { type, role, steam_id, entity_id } = notification;
  if (type === "PlayerWarning") {
    return "warning";
  }
  if (type === "TeammateBanned") {
    return "ban";
  }
  if (
    type === "PlayerSanctioned" &&
    (role === "administrator" || (!!steam_id && steam_id === entity_id))
  ) {
    return "ban";
  }
  return null;
}

export const sanctionToneBarClasses: Record<SanctionTone, string> = {
  ban: "bg-destructive",
  warning: "bg-[hsl(var(--tac-amber))]",
};

export const sanctionToneTextClasses: Record<SanctionTone, string> = {
  ban: "text-destructive",
  warning: "text-[hsl(var(--tac-amber))]",
};
