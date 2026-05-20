<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
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
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { generateMutation } from "~/graphql/graphqlGen";
import ClipRenderProgress from "~/components/clips/ClipRenderProgress.vue";
import { useClipRenderActive } from "~/composables/useClipRenderActive";

const { t } = useI18n();
const nuxtApp = useNuxtApp();

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

const selectedMatchMapId = ref<string | null>(null);
const presetChoice = ref<Preset>("multikills");
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
    submitting.value = false;
    submitError.value = null;
    renderingJobId.value = null;
    presetChoice.value = "multikills";
    resolution.value = "1080p";
    selectedMatchMapId.value = props.matchMaps[0]?.id ?? null;
  },
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
  () => !!selectedMatchMapId.value && !submitting.value,
);

async function submit() {
  if (submitting.value || !selectedMatchMapId.value) return;
  submitting.value = true;
  submitError.value = null;
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        createClipFromPreset: [
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
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Sparkles class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          Render highlight
          <span v-if="targetName" class="text-muted-foreground">
            · {{ targetName }}
          </span>
        </DialogTitle>
        <DialogDescription>
          Queue a one-click highlight from a demo on this match.
        </DialogDescription>
      </DialogHeader>

      <ClipRenderProgress
        v-if="renderingJobId"
        :job-id="renderingJobId"
        @close="close(false)"
      />

      <form v-else class="space-y-5" @submit.prevent="submit">
        <div class="space-y-2">
          <Label>Map</Label>
          <Select
            :model-value="selectedMatchMapId ?? ''"
            @update:model-value="
              (v) => (selectedMatchMapId = (v as string) || null)
            "
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a map" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="mm in matchMaps" :key="mm.id" :value="mm.id">
                {{ mm.label }}
              </SelectItem>
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
          <Button type="submit" :disabled="!canSubmit">
            <Loader2 v-if="submitting" class="h-4 w-4 mr-2 animate-spin" />
            <Film v-else class="h-4 w-4 mr-2" />
            Queue render
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
