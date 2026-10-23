import type { UtilityRunningPracticeSession } from "~/types/utility";

/** The word a running practice server is shown with, on its row and its panel. */
export function practiceServerState(
  session: UtilityRunningPracticeSession,
  t: (key: string) => string,
) {
  if (session.status === "Starting") {
    return {
      label: t("pages.utility.practice.nav_starting"),
      tone: "text-muted-foreground",
    };
  }

  if (session.map_changing_at) {
    return {
      label: t("pages.utility.practice.nav_switching"),
      tone: "text-muted-foreground",
    };
  }

  return {
    label: t("pages.utility.practice_servers.ready"),
    tone: "text-[hsl(var(--tac-amber))]",
  };
}
