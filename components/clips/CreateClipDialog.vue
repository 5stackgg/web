<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Film, Loader2, Sparkles, Sword, Crown, Trophy } from "lucide-vue-next";
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
const nuxtApp = useNuxtApp();

type Preset = "knife" | "multikills" | "best_round" | "recap";
const presetTarget = ref<string | null>(null);
const presetChoice = ref<Preset>("multikills");
const PRESETS: Array<{
  value: Preset;
  label: string;
  hint: string;
  icon: any;
}> = [
  {
    value: "multikills",
    label: "Multi-kills",
    hint: "Every round with 2+ kills, trimmed to the action",
    icon: Sparkles,
  },
  {
    value: "best_round",
    label: "Best round",
    hint: "Single round with the most kills",
    icon: Trophy,
  },
  {
    value: "knife",
    label: "Knife kills",
    hint: "Each knife frag with a 5s lead-in",
    icon: Sword,
  },
  {
    value: "recap",
    label: "Match recap",
    hint: "Every round the player got at least one kill",
    icon: Crown,
  },
];

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
const ctTeamLabel = computed(() => store.gsiTeamCtName || "Counter-Terrorists");
const tTeamLabel = computed(() => store.gsiTeamTName || "Terrorists");

async function submit() {
  if (submitting.value) return;
  if (!presetTarget.value) {
    submitError.value = "Pick a player to highlight";
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
            fps: 60,
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
          Auto Clip
        </DialogTitle>
        <DialogDescription>
          Pick a player and a preset — the server scans the match's parsed
          kills, builds the segments, and renders an mp4.
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
            Player
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
              <SelectValue placeholder="Pick a player to highlight" />
            </SelectTrigger>
            <SelectContent>
              <div
                v-if="presetPlayers.length === 0"
                class="px-2 py-3 text-xs text-muted-foreground"
              >
                No players found yet — wait for the demo to start playing, then
                try again.
              </div>
              <SelectGroup v-if="ctPresetPlayers.length">
                <SelectLabel
                  class="text-[0.65rem] uppercase tracking-wider text-blue-300"
                >
                  {{ ctTeamLabel }} (CT)
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
                  {{ tTeamLabel }} (T)
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
                  Other
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
          <Label>Preset</Label>
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
          <Label for="clip-title">Title</Label>
          <Input
            id="clip-title"
            v-model="title"
            placeholder="Defaults to preset name"
            maxlength="80"
          />
        </div>

        <div class="space-y-2">
          <Label>Resolution</Label>
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
            Cancel
          </Button>
          <Button type="submit" :disabled="!canSubmit || submitting">
            <Loader2 v-if="submitting" class="h-4 w-4 mr-2 animate-spin" />
            <Film v-else class="h-4 w-4 mr-2" />
            Generate highlights
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
