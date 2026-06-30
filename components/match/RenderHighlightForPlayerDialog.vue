<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Film, Sparkles, Sword, Crown, Trophy } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { useNuxtApp } from "#app";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import SettingHeader from "~/components/match/SettingHeader.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { useToast } from "~/components/ui/toast/use-toast";

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const { toast } = useToast();

type MapWithDemo = {
  id: string;
  label: string;
};

type Preset = "knife" | "multikills" | "best_round" | "recap";

const props = defineProps<{
  open: boolean;
  matchMaps: MapWithDemo[];
  targetSteamId: string;
  targetName: string | null;
}>();
const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
}>();

type Availability = {
  has_demo: boolean;
  knife: boolean;
  multikills: boolean;
  best_round: boolean;
  recap: boolean;
};

const PRESET_ORDER: Preset[] = ["multikills", "best_round", "knife", "recap"];

const selectedMatchMapId = ref<string | null>(null);
const presetChoice = ref<Preset>("multikills");
const resolution = ref<"720p" | "1080p">("1080p");
const submitting = ref(false);
const submitError = ref<string | null>(null);
const availability = ref<Availability | null>(null);
const loadingAvailability = ref(false);

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    submitting.value = false;
    submitError.value = null;
    presetChoice.value = "multikills";
    resolution.value = "1080p";
    availability.value = null;
    selectedMatchMapId.value = props.matchMaps[0]?.id ?? null;
  },
);

watch(
  [() => props.open, selectedMatchMapId, () => props.targetSteamId],
  () => {
    if (!props.open) return;
    void loadAvailability();
  },
  { immediate: true },
);

async function loadAvailability() {
  const matchMapId = selectedMatchMapId.value;
  if (!matchMapId) {
    availability.value = null;
    return;
  }
  loadingAvailability.value = true;
  availability.value = null;
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      fetchPolicy: "network-only",
      query: generateQuery({
        getHighlightPresetAvailability: [
          {
            match_map_id: matchMapId,
            target_steam_id: props.targetSteamId,
          },
          {
            has_demo: true,
            knife: true,
            multikills: true,
            best_round: true,
            recap: true,
          },
        ],
      } as any),
    });
    if (selectedMatchMapId.value !== matchMapId) return;
    availability.value = (data as any)?.getHighlightPresetAvailability ?? null;
    ensureValidPreset();
  } catch {
    if (selectedMatchMapId.value === matchMapId) {
      availability.value = null;
    }
  } finally {
    if (selectedMatchMapId.value === matchMapId) {
      loadingAvailability.value = false;
    }
  }
}

function isPresetAvailable(p: Preset): boolean {
  if (!availability.value) return true;
  return availability.value[p] === true;
}

function presetUnavailableHint(p: Preset): string {
  switch (p) {
    case "knife":
      return "No knife kills on this map";
    case "multikills":
      return "No multi-kill rounds on this map";
    default:
      return "No kills on this map";
  }
}

function ensureValidPreset() {
  if (isPresetAvailable(presetChoice.value)) return;
  const next = PRESET_ORDER.find((p) => isPresetAvailable(p));
  if (next) presetChoice.value = next;
}

const noPresetsAvailable = computed(
  () =>
    !!availability.value &&
    !availability.value.knife &&
    !availability.value.multikills &&
    !availability.value.best_round &&
    !availability.value.recap,
);

const PRESETS = computed<
  Array<{ value: Preset; label: string; hint: string; icon: any }>
>(() => [
  {
    value: "multikills",
    label: t("clips.presets.multikills"),
    hint: t("clips.presets.multikills_hint"),
    icon: Sparkles,
  },
  {
    value: "best_round",
    label: t("clips.presets.best_round"),
    hint: t("clips.presets.best_round_hint"),
    icon: Trophy,
  },
  {
    value: "knife",
    label: t("clips.presets.knife"),
    hint: t("clips.presets.knife_hint"),
    icon: Sword,
  },
  {
    value: "recap",
    label: t("clips.presets.recap"),
    hint: t("clips.presets.recap_hint"),
    icon: Crown,
  },
]);

const canSubmit = computed(
  () =>
    !!selectedMatchMapId.value &&
    !submitting.value &&
    !loadingAvailability.value &&
    !noPresetsAvailable.value &&
    isPresetAvailable(presetChoice.value),
);

async function submit() {
  if (!canSubmit.value || !selectedMatchMapId.value) return;
  submitting.value = true;
  submitError.value = null;
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        queueClipFromPreset: [
          {
            match_map_id: selectedMatchMapId.value,
            target_steam_id: props.targetSteamId,
            preset: presetChoice.value,
            resolution: resolution.value,
            fps: 60,
            target_name: props.targetName ?? undefined,
          },
          { success: true, job_id: true },
        ],
      } as any),
    });
    const out = (data as any)?.queueClipFromPreset;
    if (!out?.success || !out?.job_id) {
      throw new Error("queueClipFromPreset returned no job");
    }
    toast({
      title: t("render_queue_status.highlight_queued_title"),
      description: props.targetName
        ? t("render_queue_status.highlight_queued_desc_named", {
            name: props.targetName,
          })
        : t("render_queue_status.highlight_queued_desc"),
    });
    close(false);
  } catch (e) {
    submitError.value =
      (e as any)?.graphQLErrors?.[0]?.message ??
      (e as Error)?.message ??
      "Failed to submit highlight";
  } finally {
    submitting.value = false;
  }
}

function close(v: boolean) {
  emit("update:open", v);
}
</script>

<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Sparkles class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{ $t("clips.render_dialog.title") }}
          <span v-if="targetName" class="text-muted-foreground">
            · {{ targetName }}
          </span>
        </DialogTitle>
        <DialogDescription>
          {{ $t("clips.render_dialog.description") }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-5" @submit.prevent="submit">
        <div class="space-y-2">
          <SettingHeader>{{ $t("clips.render_dialog.map") }}</SettingHeader>
          <Select
            :model-value="selectedMatchMapId ?? ''"
            @update:model-value="
              (v) => (selectedMatchMapId = (v as string) || null)
            "
          >
            <SelectTrigger>
              <SelectValue :placeholder="$t('clips.render_dialog.pick_map')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="mm in matchMaps" :key="mm.id" :value="mm.id">
                {{ mm.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <SettingHeader>
            {{ $t("clips.create_dialog.preset") }}
            <Spinner
              v-if="loadingAvailability"
              class="inline-block h-3 w-3 text-muted-foreground align-middle ml-2"
            />
          </SettingHeader>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="p in PRESETS"
              :key="p.value"
              type="button"
              :disabled="!isPresetAvailable(p.value)"
              :title="
                isPresetAvailable(p.value)
                  ? undefined
                  : presetUnavailableHint(p.value)
              "
              :class="[
                'flex items-start gap-2 rounded-md border p-3 text-left transition-all duration-150',
                !isPresetAvailable(p.value)
                  ? 'border-border/40 bg-card/20 opacity-40 cursor-not-allowed'
                  : presetChoice === p.value
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.1)]'
                    : 'border-border/60 bg-card/40 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-muted/40',
              ]"
              @click="isPresetAvailable(p.value) && (presetChoice = p.value)"
            >
              <component :is="p.icon" class="h-4 w-4 mt-0.5 shrink-0" />
              <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-medium">{{ p.label }}</span>
                <span class="text-[0.7rem] text-muted-foreground leading-snug">
                  {{
                    isPresetAvailable(p.value)
                      ? p.hint
                      : presetUnavailableHint(p.value)
                  }}
                </span>
              </span>
            </button>
          </div>
          <p v-if="noPresetsAvailable" class="text-xs text-muted-foreground">
            {{
              $t("clips.render_dialog.no_moments", {
                target: targetName ?? $t("clips.render_dialog.this_player"),
              })
            }}
          </p>
        </div>

        <div class="space-y-2">
          <SettingHeader>{{ $t("clips.create_dialog.resolution") }}</SettingHeader>
          <Select v-model="resolution">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="720p">720p</SelectItem>
              <SelectItem value="1080p">1080p</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p v-if="submitError" class="text-xs text-destructive">
          {{ submitError }}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            :disabled="submitting"
            @click="close(false)"
          >
            {{ $t("common.cancel") }}
          </Button>
          <Button type="submit" variant="tactical" :disabled="!canSubmit">
            <Spinner v-if="submitting" class="h-4 w-4 mr-2" />
            <Film v-else class="h-4 w-4 mr-2" />
            {{ $t("clips.render_dialog.queue_render") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
