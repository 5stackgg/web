import { useI18n } from "vue-i18n";

// The bottom edge of StreamStatusPanel: a sweeping bar while waiting on
// something open-ended, or one segment per boot step.
export type StreamStatusProgress =
  | "indeterminate"
  | { steps: number; current: number; fraction?: number | null };

// What WhepPlayer reports while it has no picture to show.
export type WhepPhase = "connecting" | "waiting" | "reconnecting" | "failed";

export type StreamStatusCopy = {
  title: string;
  hint: string | null;
  tone: "default" | "error";
  progress: "indeterminate" | null;
};

// One wording for every surface that shows a WHEP stream, whether it draws
// the bare status bar or the full match caption around it.
export function useWhepStatusCopy() {
  const { t } = useI18n();

  function copyFor(phase: WhepPhase): StreamStatusCopy {
    switch (phase) {
      case "connecting":
        return {
          title: t("match.stream.connecting"),
          hint: null,
          tone: "default",
          progress: "indeterminate",
        };
      case "waiting":
        return {
          title: t("match.stream.waiting"),
          hint: t("match.stream.waiting_hint"),
          tone: "default",
          progress: "indeterminate",
        };
      case "reconnecting":
        return {
          title: t("match.stream.reconnecting"),
          hint: t("match.stream.reconnecting_hint"),
          tone: "default",
          progress: "indeterminate",
        };
      case "failed":
        return {
          title: t("match.stream.unreachable"),
          hint: null,
          tone: "error",
          progress: null,
        };
    }
  }

  return { copyFor };
}
