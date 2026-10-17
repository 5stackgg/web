// The CS2 video presets a node's video settings are edited against (EditCs2Options)
// and named by in the inspector.

// Form keys are flat (no dots) so vee-validate's path parser doesn't
// treat them as nested. We translate to/from the real `setting.*` JSON
// keys in the watch handler and save method.
export type VideoForm = Record<string, number | null>;

// Locked keys (fullscreen, nowindowborder, coop_fullscreen,
// fullscreen_min_on_focus_loss, high_dpi, mat_vsync, aspectratiomode,
// refreshrate_numerator, refreshrate_denominator, monitor_index,
// cpu_level, gpu_level, gpu_mem_level, r_low_latency, videocfg_hdr_detail,
// videocfg_fsr_detail) are enforced by the streamer (cs2-options.sh) and
// intentionally not exposed in the UI. r_low_latency is driven per-flow:
// live=2, demo=0.
export const FORM_KEYS = [
  "msaa_samples",
  "r_csgo_cmaa_enable",
  "r_texturefilteringquality",
  "shaderquality",
  "videocfg_shadow_quality",
  "videocfg_dynamic_shadows",
  "videocfg_texture_detail",
  "videocfg_particle_detail",
  "videocfg_ao_detail",
] as const;

// Quality presets. `auto` is the new default — empty JSONB so the
// streamer skips writing cs2_video.txt and CS2's first-launch
// auto-detect runs against the actual GPU. low/medium/high apply
// explicit overrides; resolution stays orthogonal.
export type PresetName = "auto" | "low" | "medium" | "high";
export type ExplicitPreset = Exclude<PresetName, "auto">;
export const PRESETS: Record<ExplicitPreset, VideoForm> = {
  low: {
    msaa_samples: 0,
    r_csgo_cmaa_enable: 0,
    r_texturefilteringquality: 0,
    shaderquality: 0,
    videocfg_shadow_quality: 0,
    videocfg_dynamic_shadows: 0,
    videocfg_texture_detail: 0,
    videocfg_particle_detail: 0,
    videocfg_ao_detail: 0,
  },
  medium: {
    msaa_samples: 2,
    r_csgo_cmaa_enable: 0,
    r_texturefilteringquality: 2,
    shaderquality: 0,
    videocfg_shadow_quality: 1,
    videocfg_dynamic_shadows: 1,
    videocfg_texture_detail: 1,
    videocfg_particle_detail: 1,
    videocfg_ao_detail: 1,
  },
  high: {
    msaa_samples: 4,
    r_csgo_cmaa_enable: 0,
    r_texturefilteringquality: 5,
    shaderquality: 1,
    videocfg_shadow_quality: 3,
    videocfg_dynamic_shadows: 1,
    videocfg_texture_detail: 2,
    videocfg_particle_detail: 2,
    videocfg_ao_detail: 2,
  },
};

// Which preset stored settings match, read the way EditCs2Options fills its
// form: auto when nothing is stored, null when tuned away from every preset.
export function videoPresetOf(
  stored: Record<string, number | null> | null | undefined,
): PresetName | null {
  const settings = stored ?? {};
  if (Object.keys(settings).length === 0) {
    return "auto";
  }
  for (const name of Object.keys(PRESETS) as ExplicitPreset[]) {
    if (
      FORM_KEYS.every(
        (key) =>
          (settings[`setting.${key}`] ?? PRESETS.low[key] ?? null) ===
          PRESETS[name][key],
      )
    ) {
      return name;
    }
  }
  return null;
}
