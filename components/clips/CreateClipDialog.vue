<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Film, Loader2, Sparkles, Sword, Crown, Trophy } from "lucide-vue-next";
import { useNuxtApp } from "#app";

const { t } = useI18n();
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { generateMutation } from "~/graphql/graphqlGen";
import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import ClipRenderProgress from "~/components/clips/ClipRenderProgress.vue";
import { useClipRenderActive } from "~/composables/useClipRenderActive";

// One-click highlight-reel preset. Manual trim editing lives in
// ClipEditorBar on the demo page.
const props = defineProps<{
  open: boolean;
  matchMapId: string;
  initialMode?: "manual" | "auto";
}>();
const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
}>();

const store = useDemoPlaybackStore();
const appSettings = useApplicationSettingsStore();
const nuxtApp = useNuxtApp();

const clipFps = computed<30 | 60>(() => {
  const raw = appSettings.settings.find((s) => s.name === "clip_fps")?.value;
  return raw === "30" ? 30 : 60;
});

type Preset = "knife" | "multikills" | "best_round" | "recap";
const presetTarget = ref<string | null>(null);
const presetChoice = ref<Preset>("multikills");
const PRESETS = computed<
  Array<{
    value: Preset;
    label: string;
    hint: string;
    icon: any;
  }>
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

const title = ref("");
const resolution = ref<"720p" | "1080p">("1080p");
const submitting = ref(false);
const submitError = ref<string | null>(null);
const renderingJobId = ref<string | null>(null);
const { trackJob: trackRenderJob } = useClipRenderActive();
watch(renderingJobId, (id) => trackRenderJob(id));

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    title.value = "";
    resolution.value = "1080p";
    submitting.value = false;
    submitError.value = null;
    renderingJobId.value = null;
    presetTarget.value = store.spectatedSteamId ?? null;
    presetChoice.value = "multikills";
  },
);

const canSubmit = computed(() => !!presetTarget.value && !submitting.value);

type DemoPlayer = {
  steam_id: string;
  name: string;
  team: "T" | "CT" | null;
};
// Sourced from kills + GSI rather than the api lineup — demos can be
// cross-loaded against a different match.
const presetPlayers = computed<DemoPlayer[]>(() => {
  const seen = new Set<string>();
  const out: DemoPlayer[] = [];
  const gsiByStId = new Map<string, (typeof store.specSlots)[number]>();
  for (const s of store.specSlots) {
    if (s.steam_id) gsiByStId.set(s.steam_id, s);
  }
  const add = (sid: string | undefined) => {
    if (!sid || seen.has(sid)) return;
    seen.add(sid);
    const gsi = gsiByStId.get(sid);
    out.push({
      steam_id: sid,
      name: gsi?.name ?? store.playerNames[sid] ?? `#${sid.slice(-4)}`,
      team: gsi?.team ?? null,
    });
  };
  for (const k of store.kills) {
    add(k.killer);
    add(k.victim);
  }
  for (const s of store.specSlots) add(s.steam_id);
  return out.sort((a, b) => a.name.localeCompare(b.name));
});
const ctPresetPlayers = computed(() =>
  presetPlayers.value.filter((p) => p.team === "CT"),
);
const tPresetPlayers = computed(() =>
  presetPlayers.value.filter((p) => p.team === "T"),
);
const otherPresetPlayers = computed(() =>
  presetPlayers.value.filter((p) => p.team !== "CT" && p.team !== "T"),
);
const ctTeamLabel = computed(
  () => store.gsiTeamCtName || t("match.replay.counter_terrorists"),
);
const tTeamLabel = computed(
  () => store.gsiTeamTName || t("match.replay.terrorists"),
);

async function submit() {
  if (submitting.value) return;
  if (!presetTarget.value) {
    submitError.value = t("clips.create_dialog.pick_player_placeholder");
    return;
  }
  submitError.value = null;
  submitting.value = true;
  // GSI is freshest; fall back to rosters / playerNames for cross-loaded demos.
  const targetName = (() => {
    const sid = presetTarget.value!;
    const gsi = store.specSlots.find((s) => s.steam_id === sid);
    if (gsi?.name) return gsi.name;
    const rosterMatch =
      store.rosters.lineup1.find((p) => p.steam_id === sid) ??
      store.rosters.lineup2.find((p) => p.steam_id === sid);
    return rosterMatch?.name ?? store.playerNames[sid] ?? undefined;
  })();
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        createClipFromPreset: [
          {
            match_map_id: props.matchMapId,
            target_steam_id: presetTarget.value,
            preset: presetChoice.value,
            resolution: resolution.value,
            fps: clipFps.value,
            title: title.value || undefined,
            target_name: targetName,
          },
          { success: true, job_id: true },
        ],
      } as any),
    });
    const out = (data as any)?.createClipFromPreset;
    if (!out?.success || !out?.job_id) {
      throw new Error("createClipFromPreset returned no job");
    }
    renderingJobId.value = out.job_id;
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
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Sparkles class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{ $t("clips.create_dialog.title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("clips.create_dialog.description") }}
        </DialogDescription>
      </DialogHeader>

      <ClipRenderProgress
        v-if="renderingJobId"
        :job-id="renderingJobId"
        @close="close(false)"
      />

      <form v-else class="space-y-5" @submit.prevent="submit">
        <div class="space-y-2">
          <Label>
            {{ $t("clips.create_dialog.player") }}
            <span class="text-destructive">*</span>
          </Label>
          <Select
            :model-value="presetTarget ?? ''"
            @update:model-value="(v) => (presetTarget = (v as string) || null)"
          >
            <SelectTrigger
              :class="[
                !presetTarget && submitError
                  ? 'border-destructive ring-1 ring-destructive/40'
                  : '',
              ]"
            >
              <SelectValue
                :placeholder="$t('clips.create_dialog.pick_player_placeholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <div
                v-if="presetPlayers.length === 0"
                class="px-2 py-3 text-xs text-muted-foreground"
              >
                {{ $t("clips.create_dialog.no_players_yet") }}
              </div>
              <SelectGroup v-if="ctPresetPlayers.length">
                <SelectLabel
                  class="text-[0.65rem] uppercase tracking-wider text-blue-300"
                >
                  {{ ctTeamLabel }} {{ $t("clips.ct") }}
                </SelectLabel>
                <SelectItem
                  v-for="p in ctPresetPlayers"
                  :key="p.steam_id"
                  :value="p.steam_id"
                >
                  {{ p.name }}
                </SelectItem>
              </SelectGroup>
              <SelectGroup v-if="tPresetPlayers.length">
                <SelectLabel
                  class="text-[0.65rem] uppercase tracking-wider text-amber-300"
                >
                  {{ tTeamLabel }} {{ $t("clips.t") }}
                </SelectLabel>
                <SelectItem
                  v-for="p in tPresetPlayers"
                  :key="p.steam_id"
                  :value="p.steam_id"
                >
                  {{ p.name }}
                </SelectItem>
              </SelectGroup>
              <SelectGroup v-if="otherPresetPlayers.length">
                <SelectLabel
                  class="text-[0.65rem] uppercase tracking-wider text-muted-foreground"
                >
                  {{ $t("clips.create_dialog.other_group") }}
                </SelectLabel>
                <SelectItem
                  v-for="p in otherPresetPlayers"
                  :key="p.steam_id"
                  :value="p.steam_id"
                >
                  {{ p.name }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label>{{ $t("clips.create_dialog.preset") }}</Label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="p in PRESETS"
              :key="p.value"
              type="button"
              :class="[
                'flex items-start gap-2 rounded-md border p-3 text-left transition-all duration-150',
                presetChoice === p.value
                  ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.1)]'
                  : 'border-border/60 bg-card/40 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-muted/40',
              ]"
              @click="presetChoice = p.value"
            >
              <component :is="p.icon" class="h-4 w-4 mt-0.5 shrink-0" />
              <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-medium">{{ p.label }}</span>
                <span class="text-[0.7rem] text-muted-foreground leading-snug">
                  {{ p.hint }}
                </span>
              </span>
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="clip-title">{{
            $t("clips.create_dialog.title_label")
          }}</Label>
          <Input
            id="clip-title"
            v-model="title"
            :placeholder="$t('clips.create_dialog.title_placeholder')"
            maxlength="80"
          />
        </div>

        <div class="space-y-2">
          <Label>{{ $t("clips.create_dialog.resolution") }}</Label>
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
          <Button type="submit" :disabled="!canSubmit || submitting">
            <Loader2 v-if="submitting" class="h-4 w-4 mr-2 animate-spin" />
            <Film v-else class="h-4 w-4 mr-2" />
            {{ $t("clips.create_dialog.submit") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
