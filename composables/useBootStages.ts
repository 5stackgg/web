import { useI18n } from "vue-i18n";

// The four operating modes a game-streamer pod boots through. Each maps to
// its own ordered stage list — the single source of truth shared by every
// boot stepper (BootSequence.vue).
export type BootMode = "live" | "demo" | "highlights" | "bake";

export type BootStageMeta = "required" | "conditional" | "implicit";

export type BootStage = {
  key: string;
  label: string;
  // How a non-emitted stage renders once we're past it:
  //   required    → ✓ silently (must have happened)
  //   conditional → "skipped" (warm pod / stock map / cached creds)
  //   implicit    → hidden entirely (internal sub-step)
  meta: BootStageMeta;
  // Keep the stage in the spinning "current" state after it fires, until the
  // named gating stage fires — covers background work (demo download) that
  // runs in parallel and only blocks at a known checkpoint.
  concurrentUntil?: string;
};

export function useBootStages() {
  const { t } = useI18n();

  function stagesFor(mode: BootMode): BootStage[] {
    switch (mode) {
      case "live":
        return [
          { key: "booting", label: t("live_stages.booting"), meta: "required" },
          {
            key: "downloading_cs2",
            label: t("live_stages.downloading_cs2"),
            meta: "conditional",
          },
          {
            key: "launching_steam",
            label: t("live_stages.launching_steam"),
            meta: "required",
          },
          {
            key: "logging_in",
            label: t("live_stages.logging_in"),
            meta: "implicit",
          },
          {
            key: "launching_cs2",
            label: t("live_stages.launching_cs2"),
            meta: "required",
          },
          {
            key: "processing_shaders",
            label: t("live_stages.processing_shaders"),
            meta: "conditional",
          },
          {
            key: "connecting_to_game",
            label: t("live_stages.connecting_to_game"),
            meta: "required",
          },
          { key: "live", label: t("live_stages.live"), meta: "required" },
        ];
      case "demo":
        return [
          { key: "booting", label: t("live_stages.booting"), meta: "required" },
          {
            key: "downloading_demo",
            label: t("live_stages.downloading_demo"),
            meta: "required",
            concurrentUntil: "launching_cs2",
          },
          {
            key: "downloading_cs2",
            label: t("live_stages.downloading_cs2"),
            meta: "conditional",
          },
          {
            key: "launching_steam",
            label: t("live_stages.launching_steam"),
            meta: "required",
          },
          {
            key: "logging_in",
            label: t("live_stages.logging_in"),
            meta: "implicit",
          },
          {
            key: "downloading_workshop_map",
            label: t("live_stages.downloading_workshop_map"),
            meta: "conditional",
          },
          {
            key: "launching_cs2",
            label: t("live_stages.launching_cs2"),
            meta: "required",
          },
          {
            key: "processing_shaders",
            label: t("live_stages.processing_shaders"),
            meta: "conditional",
          },
          {
            key: "connecting_to_game",
            label: t("live_stages.loading_demo_into_cs2"),
            meta: "required",
          },
          // `playing` is intentionally omitted — WHEP mounts at that moment.
          { key: "live", label: t("live_stages.demo_loading"), meta: "required" },
        ];
      case "highlights":
        return [
          {
            key: "downloading_demo",
            label: t("live_stages.downloading_demo"),
            meta: "required",
            concurrentUntil: "launching_cs2",
          },
          {
            key: "downloading_cs2",
            label: t("live_stages.downloading_cs2"),
            meta: "conditional",
          },
          {
            key: "launching_steam",
            label: t("live_stages.launching_steam"),
            meta: "required",
          },
          {
            key: "logging_in",
            label: t("live_stages.logging_in"),
            meta: "implicit",
          },
          {
            key: "downloading_workshop_map",
            label: t("live_stages.downloading_workshop_map"),
            meta: "conditional",
          },
          {
            key: "launching_cs2",
            label: t("live_stages.loading_demo_in_cs2"),
            meta: "required",
          },
          {
            key: "processing_shaders",
            label: t("live_stages.processing_shaders"),
            meta: "conditional",
          },
          {
            key: "connecting_to_game",
            label: t("live_stages.queuing_demo"),
            meta: "implicit",
          },
        ];
      case "bake":
        return [
          {
            key: "Initializing",
            label: t("live_stages.initializing"),
            meta: "implicit",
          },
          {
            key: "downloading_cs2",
            label: t("live_stages.downloading_cs2"),
            meta: "conditional",
          },
          {
            key: "launching_cs2",
            label: t("live_stages.launching_cs2"),
            meta: "required",
          },
          {
            key: "processing_shaders",
            label: t("live_stages.processing_shaders"),
            meta: "required",
          },
        ];
    }
  }

  return { stagesFor };
}
