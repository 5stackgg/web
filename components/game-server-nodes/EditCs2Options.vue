<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
</script>

<template>
  <Sheet :open="open" @update:open="(o) => o === false && $emit('close')">
    <SheetContent class="overflow-y-auto sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle>{{ $t("game_server.cs2_options.title") }}</SheetTitle>
        <SheetDescription>
          {{ $t("game_server.cs2_options.description") }}
        </SheetDescription>
      </SheetHeader>

      <form @submit.prevent="save" class="space-y-4 pt-4">
        <p class="text-sm text-muted-foreground">
          {{ $t("game_server.cs2_options.section_video_description") }}
        </p>

        <div class="rounded-lg border p-3 space-y-2">
          <div>
            <div class="text-sm font-medium">
              {{ $t("game_server.cs2_options.preset.title") }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("game_server.cs2_options.preset.description") }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="name of presetNames"
              :key="name"
              type="button"
              :variant="activePreset === name ? 'default' : 'outline'"
              size="sm"
              @click="applyPreset(name)"
            >
              {{ $t(presetLabels[name]) }}
            </Button>
          </div>
          <p v-if="isAuto" class="text-xs text-muted-foreground border-t pt-2">
            {{ $t("game_server.cs2_options.preset.auto_active") }}
          </p>
        </div>

        <fieldset :disabled="isAuto" :class="isAuto ? 'opacity-50' : ''">
          <FormField v-slot="{ value }" name="resolution">
            <FormItem class="rounded-lg border p-3">
              <FormLabel class="text-sm">
                {{ $t("game_server.cs2_options.video.resolution") }}
              </FormLabel>
              <FormDescription class="text-xs">
                {{ $t("game_server.cs2_options.video.resolution_desc") }}
              </FormDescription>
              <FormControl>
                <Select
                  :model-value="value"
                  @update:model-value="
                    (v) =>
                      form.setFieldValue(
                        'resolution',
                        (v as string) ?? '1920x1080',
                      )
                  "
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        v-for="r of resolutions"
                        :key="`${r.width}x${r.height}`"
                        :value="`${r.width}x${r.height}`"
                      >
                        {{ r.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          </FormField>

          <div class="rounded-lg border p-3 space-y-2">
            <div>
              <div class="text-sm font-medium">
                {{ $t("game_server.cs2_options.video.aa.label") }}
              </div>
              <p class="text-xs text-muted-foreground">
                {{ $t("game_server.cs2_options.video.aa.description") }}
              </p>
            </div>
            <Select
              :model-value="antialiasing"
              @update:model-value="(v) => setAntialiasing(v as string)"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="opt of aaOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ $t(opt.labelKey) }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <FormField
            v-for="field of booleanVideoFields"
            v-slot="{ value }"
            :key="field.key"
            :name="`video.${field.key}`"
          >
            <FormItem
              class="flex flex-row items-center justify-between gap-4 rounded-lg border p-3"
            >
              <div class="space-y-0.5">
                <FormLabel class="text-sm">{{ $t(field.labelKey) }}</FormLabel>
                <FormDescription class="text-xs">
                  {{ $t(field.descKey) }}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  :model-value="value === 1"
                  @update:model-value="
                    (v) =>
                      form.setFieldValue(
                        `video.${field.key}` as never,
                        (v ? 1 : 0) as never,
                      )
                  "
                />
              </FormControl>
            </FormItem>
          </FormField>

          <FormField
            v-for="field of enumVideoFields"
            v-slot="{ value }"
            :key="field.key"
            :name="`video.${field.key}`"
          >
            <FormItem class="rounded-lg border p-3">
              <FormLabel class="text-sm">{{ $t(field.labelKey) }}</FormLabel>
              <FormDescription class="text-xs">
                {{ $t(field.descKey) }}
              </FormDescription>
              <FormControl>
                <Select
                  :model-value="
                    value !== null && value !== undefined
                      ? String(value)
                      : undefined
                  "
                  @update:model-value="
                    (v) =>
                      form.setFieldValue(
                        `video.${field.key}` as never,
                        (v === null || v === undefined
                          ? null
                          : parseInt(v as string, 10)) as never,
                      )
                  "
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        v-for="opt of field.options"
                        :key="opt.value"
                        :value="String(opt.value)"
                      >
                        {{ $t(opt.labelKey) }} ({{ opt.value }})
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          </FormField>
        </fieldset>

        <div class="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" @click="$emit('close')">
            {{ $t("common.cancel") }}
          </Button>
          <Button type="submit">
            {{ $t("game_server.cs2_options.save") }}
          </Button>
        </div>
      </form>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";
import { toast } from "@/components/ui/toast";

// Form keys are flat (no dots) so vee-validate's path parser doesn't
// treat them as nested. We translate to/from the real `setting.*` JSON
// keys in the watch handler and save method.
type VideoForm = Record<string, number | null>;

// Locked keys (fullscreen, nowindowborder, coop_fullscreen,
// fullscreen_min_on_focus_loss, high_dpi, mat_vsync, aspectratiomode,
// refreshrate_numerator, refreshrate_denominator, monitor_index,
// cpu_level, gpu_level, gpu_mem_level, r_low_latency, videocfg_hdr_detail,
// videocfg_fsr_detail) are enforced by the streamer (cs2-options.sh) and
// intentionally not exposed in the UI. r_low_latency is driven per-flow:
// live=2, demo=0.
const FORM_KEYS = [
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

const RESOLUTIONS = [
  { label: "1080p (1920×1080)", width: 1920, height: 1080 },
  { label: "1440p (2560×1440)", width: 2560, height: 1440 },
] as const;
const DEFAULT_RESOLUTION = "1920x1080";
const resolutionKey = (w?: number | null, h?: number | null) =>
  w && h ? `${w}x${h}` : DEFAULT_RESOLUTION;

// Quality presets. `auto` is the new default — empty JSONB so the
// streamer skips writing cs2_video.txt and CS2's first-launch
// auto-detect runs against the actual GPU. low/medium/high apply
// explicit overrides; resolution stays orthogonal.
type PresetName = "auto" | "low" | "medium" | "high";
type ExplicitPreset = Exclude<PresetName, "auto">;
const PRESETS: Record<ExplicitPreset, VideoForm> = {
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

const PRESET_NAMES: readonly PresetName[] = [
  "auto",
  "low",
  "medium",
  "high",
] as const;
const PRESET_LABELS: Record<PresetName, string> = {
  auto: "game_server.cs2_options.preset.auto",
  low: "game_server.cs2_options.preset.low",
  medium: "game_server.cs2_options.preset.medium",
  high: "game_server.cs2_options.preset.high",
};

const booleanVideoFields = [
  {
    key: "videocfg_dynamic_shadows",
    labelKey: "game_server.cs2_options.video.videocfg_dynamic_shadows",
    descKey: "game_server.cs2_options.video.videocfg_dynamic_shadows_desc",
  },
] as const;

// Anti-aliasing — MSAA and CMAA2 are mutually exclusive in CS2 (the
// in-game menu picks one). Collapse the two underlying settings into a
// single selector keyed by string; we expand to msaa_samples + cmaa on
// save and derive the selector value on load.
const AA_OPTIONS = [
  {
    value: "off",
    labelKey: "game_server.cs2_options.video.aa.off",
    msaa: 0,
    cmaa: 0,
  },
  {
    value: "cmaa",
    labelKey: "game_server.cs2_options.video.aa.cmaa",
    msaa: 0,
    cmaa: 1,
  },
  {
    value: "msaa2",
    labelKey: "game_server.cs2_options.video.aa.msaa2",
    msaa: 2,
    cmaa: 0,
  },
  {
    value: "msaa4",
    labelKey: "game_server.cs2_options.video.aa.msaa4",
    msaa: 4,
    cmaa: 0,
  },
  {
    value: "msaa8",
    labelKey: "game_server.cs2_options.video.aa.msaa8",
    msaa: 8,
    cmaa: 0,
  },
] as const;
type AaValue = (typeof AA_OPTIONS)[number]["value"];
const deriveAaValue = (msaa: number | null, cmaa: number | null): AaValue => {
  if ((msaa ?? 0) > 0) {
    const m = AA_OPTIONS.find((o) => o.msaa === msaa);
    if (m) return m.value;
  }
  if (cmaa === 1) return "cmaa";
  return "off";
};

const TIER_4 = [
  { value: 0, labelKey: "game_server.cs2_options.video.low" },
  { value: 1, labelKey: "game_server.cs2_options.video.medium" },
  { value: 2, labelKey: "game_server.cs2_options.video.high" },
  { value: 3, labelKey: "game_server.cs2_options.video.very_high" },
];
const TIER_3 = [
  { value: 0, labelKey: "game_server.cs2_options.video.low" },
  { value: 1, labelKey: "game_server.cs2_options.video.medium" },
  { value: 2, labelKey: "game_server.cs2_options.video.high" },
];
const TIER_BIN = [
  { value: 0, labelKey: "game_server.cs2_options.video.low" },
  { value: 1, labelKey: "game_server.cs2_options.video.high" },
];

const enumVideoFields = [
  {
    key: "r_texturefilteringquality",
    labelKey: "game_server.cs2_options.video.r_texturefilteringquality",
    descKey: "game_server.cs2_options.video.r_texturefilteringquality_desc",
    options: [
      { value: 0, labelKey: "game_server.cs2_options.video.low" },
      { value: 1, labelKey: "game_server.cs2_options.video.low" },
      { value: 2, labelKey: "game_server.cs2_options.video.medium" },
      { value: 3, labelKey: "game_server.cs2_options.video.medium" },
      { value: 4, labelKey: "game_server.cs2_options.video.high" },
      { value: 5, labelKey: "game_server.cs2_options.video.very_high" },
    ],
  },
  {
    key: "shaderquality",
    labelKey: "game_server.cs2_options.video.shaderquality",
    descKey: "game_server.cs2_options.video.shaderquality_desc",
    options: TIER_BIN,
  },
  {
    key: "videocfg_shadow_quality",
    labelKey: "game_server.cs2_options.video.videocfg_shadow_quality",
    descKey: "game_server.cs2_options.video.videocfg_shadow_quality_desc",
    options: TIER_4,
  },
  {
    key: "videocfg_texture_detail",
    labelKey: "game_server.cs2_options.video.videocfg_texture_detail",
    descKey: "game_server.cs2_options.video.videocfg_texture_detail_desc",
    options: TIER_3,
  },
  {
    key: "videocfg_particle_detail",
    labelKey: "game_server.cs2_options.video.videocfg_particle_detail",
    descKey: "game_server.cs2_options.video.videocfg_particle_detail_desc",
    options: TIER_3,
  },
  {
    key: "videocfg_ao_detail",
    labelKey: "game_server.cs2_options.video.videocfg_ao_detail",
    descKey: "game_server.cs2_options.video.videocfg_ao_detail_desc",
    options: TIER_3,
  },
] as const;

export default {
  props: {
    open: { required: true, type: Boolean },
    gameServerNode: { type: Object, required: true },
  },
  data() {
    return {
      booleanVideoFields,
      enumVideoFields,
      resolutions: RESOLUTIONS,
      aaOptions: AA_OPTIONS,
      presetNames: PRESET_NAMES,
      presetLabels: PRESET_LABELS,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            resolution: z.string().default(DEFAULT_RESOLUTION),
            video: z.record(z.string(), z.number().nullable()).default({}),
          }),
        ),
      }),
    };
  },
  watch: {
    gameServerNode: {
      immediate: true,
      handler(node) {
        // Empty JSONB (or no overrides) ⇒ auto mode: every FORM_KEY is
        // null so `activePreset` returns "auto" and the controls render
        // disabled. Any stored value snaps the form back to explicit.
        const stored = (node.cs2_video_settings ?? {}) as Record<
          string,
          number | null
        >;
        const isAuto = Object.keys(stored).length === 0;
        const videoFilled: VideoForm = {};
        for (const k of FORM_KEYS) {
          videoFilled[k] = isAuto
            ? null
            : (stored[`setting.${k}`] ?? PRESETS.low[k] ?? null);
        }
        this.form.setValues({
          resolution: resolutionKey(
            stored["setting.defaultres"] as number | undefined,
            stored["setting.defaultresheight"] as number | undefined,
          ),
          video: videoFilled,
        });
      },
    },
  },
  computed: {
    antialiasing(): AaValue {
      const v = (this.form.values?.video ?? {}) as VideoForm;
      return deriveAaValue(
        v.msaa_samples ?? null,
        v.r_csgo_cmaa_enable ?? null,
      );
    },
    // Returns the preset whose values exactly match the current form
    // state, or null if the user has customized away from any preset.
    // Auto = every FORM_KEY is null/undefined.
    activePreset(): PresetName | null {
      const current = (this.form.values?.video ?? {}) as VideoForm;
      const allNull = FORM_KEYS.every(
        (k) => current[k] === null || current[k] === undefined,
      );
      if (allNull) return "auto";
      for (const name of Object.keys(PRESETS) as ExplicitPreset[]) {
        const preset = PRESETS[name];
        let match = true;
        for (const k of FORM_KEYS) {
          if ((current[k] ?? null) !== preset[k]) {
            match = false;
            break;
          }
        }
        if (match) return name;
      }
      return null;
    },
    isAuto(): boolean {
      return this.activePreset === "auto";
    },
  },
  methods: {
    setAntialiasing(value: string) {
      const opt = AA_OPTIONS.find((o) => o.value === value);
      if (!opt) return;
      this.form.setFieldValue("video.msaa_samples" as never, opt.msaa as never);
      this.form.setFieldValue(
        "video.r_csgo_cmaa_enable" as never,
        opt.cmaa as never,
      );
    },
    applyPreset(name: PresetName) {
      // Per-key setFieldValue so each <FormField v-slot> rebinds.
      // setFieldValue on the whole `video` object doesn't propagate.
      if (name === "auto") {
        for (const k of FORM_KEYS) {
          this.form.setFieldValue(`video.${k}` as never, null as never);
        }
        return;
      }
      const preset = PRESETS[name];
      for (const [k, v] of Object.entries(preset)) {
        this.form.setFieldValue(`video.${k}` as never, v as never);
      }
    },
    async save() {
      const { valid } = await this.form.validate();
      if (!valid) return;

      const values = this.form.values as {
        resolution: string;
        video: VideoForm;
      };

      // Auto mode: ship empty JSONB so the streamer skips writing
      // cs2_video.txt and cs2 auto-detects on first launch.
      // Otherwise: serialize all set keys with the `setting.` prefix.
      // (JSONB columns can't be inlined as GraphQL object literals so
      // we route via Zeus's `$("name", "jsonb")` placeholder + Apollo
      // `variables`.)
      const cs2_video_settings: Record<string, number> = {};
      if (!this.isAuto) {
        for (const k of FORM_KEYS) {
          const v = values.video?.[k];
          if (v !== null && v !== undefined) {
            cs2_video_settings[`setting.${k}`] = v;
          }
        }
        const resKey = values.resolution || DEFAULT_RESOLUTION;
        const match = RESOLUTIONS.find(
          (r) => `${r.width}x${r.height}` === resKey,
        );
        if (match) {
          cs2_video_settings["setting.defaultres"] = match.width;
          cs2_video_settings["setting.defaultresheight"] = match.height;
        }
      }

      await this.$apollo.mutate({
        variables: { cs2_video_settings },
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: { id: this.gameServerNode.id },
              _set: { cs2_video_settings: $("cs2_video_settings", "jsonb") },
            },
            { __typename: true },
          ],
        }),
      });

      toast({ title: this.$t("game_server.toast.cs2_options_updated") });
      this.$emit("close");
    },
  },
};
</script>
