<script setup lang="ts">
import { computed, ref } from "vue";
import { Lock, Play, Plus, RotateCcw, Settings2 } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { EXPECTED_PLAYERS } from "~/utilities/matchmakingPartySize";
import {
  DRAFT_REHOST_KEY,
  HOST_ACCESS,
  HOST_TYPES,
  formatLabel,
  hostModes,
  quickHostPayload,
  readRehostPreset,
  rehostPayload,
  type HostAccess,
  type HostMode,
} from "~/components/play/draftHost";

// In a party someone else leads: only the leader hosts for the party.
defineProps<{ locked: boolean }>();

const { t } = useI18n();
const auth = useAuthStore();
const draftGames = useDraftGamesStore();
const matchmaking = useMatchmakingStore();

const type = ref(HOST_TYPES[0].type);
const pickedMode = ref<HostMode>("Captains");
const access = ref<HostAccess>("Open");

// Picking a duel forces auto-split without forgetting the draft style picked
// for the bigger formats.
const modes = computed(() => hostModes(type.value));
const mode = computed<HostMode>({
  get: () =>
    modes.value.includes(pickedMode.value) ? pickedMode.value : modes.value[0],
  set: (value) => (pickedMode.value = value),
});

const typeOptions = HOST_TYPES.map((option) => ({
  key: option.type,
  label: formatLabel(option.type),
}));
const modeOptions = computed(() =>
  modes.value.map((key) => ({
    key,
    label: t(`pages.play.draft_rooms.types.${key.toLowerCase()}`),
  })),
);
const accessOptions = computed(() =>
  HOST_ACCESS.map((key) => ({
    key,
    label: t(`draft_games.access.${key.toLowerCase()}`),
  })),
);

const regions = computed<Array<{ value: string; description?: string }>>(
  () => matchmaking.preferredRegions,
);
const seatsLine = computed(() =>
  [
    t("pages.play.draft_rooms.host_bar.seats", {
      count: EXPECTED_PLAYERS[type.value as keyof typeof EXPECTED_PLAYERS],
    }),
    regions.value.map((region) => region.description || region.value).join(", "),
  ]
    .filter(Boolean)
    .join(" · "),
);

const myRoom = computed(() => draftGames.myDraftGame as any);

const preset = ref(readRehostPreset());
const rehostDetail = computed(() => {
  const saved = preset.value;
  const savedType = saved?.payload?.type ?? saved?.values?.type;
  if (!savedType || !saved?.mode || !saved?.access) return "";
  return t("pages.play.draft_rooms.host_bar.rehost_detail", {
    format: formatLabel(savedType),
    mode: t(`pages.play.draft_rooms.types.${saved.mode.toLowerCase()}`),
    access: t(`draft_games.access.${saved.access.toLowerCase()}`),
  });
});

async function createAndEnter(payload: Record<string, unknown>) {
  try {
    const draftGameId = await draftGames.create(payload);
    if (draftGameId) {
      await navigateTo(`/draft-room/${draftGameId}`);
    }
    return !!draftGameId;
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message ?? t("common.error"),
    });
    return false;
  }
}

async function host() {
  if (!auth.me) {
    navigateTo("/login?next=/play");
    return;
  }
  const payload = quickHostPayload({
    type: type.value,
    mode: mode.value,
    access: access.value,
    regions: regions.value.map((region) => region.value),
  });
  if (await createAndEnter(payload)) {
    try {
      localStorage.setItem(
        DRAFT_REHOST_KEY,
        JSON.stringify({ mode: mode.value, access: access.value, payload }),
      );
    } catch {}
  }
}

const rehosting = ref(false);
async function rehost() {
  if (rehosting.value) return;
  const payload = rehostPayload(preset.value);
  if (!payload) {
    navigateTo("/draft-room/create");
    return;
  }
  rehosting.value = true;
  await createAndEnter(payload);
  rehosting.value = false;
}

function allSettings() {
  navigateTo(
    auth.me ? "/draft-room/create" : "/login?next=/draft-room/create",
  );
}

const linkClasses =
  "hit inline-flex items-center gap-1.5 font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";
</script>

<template>
  <div class="rounded-lg border border-border bg-muted/25 px-4 py-3.5">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div class="flex shrink-0 items-center gap-2.5">
        <span
          class="grid size-8 place-items-center rounded-md bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]"
        >
          <Plus class="size-4" />
        </span>
        <span class="grid">
          <b class="text-sm font-bold">
            {{ $t("pages.play.draft_rooms.host_bar.title") }}
          </b>
          <span class="text-xs tabular-nums text-muted-foreground">
            {{ seatsLine }}
          </span>
        </span>
      </div>

      <div class="flex min-w-0 flex-[1_1_520px] flex-wrap items-center gap-2">
        <WatchSegmented
          v-model="type"
          :options="typeOptions"
          :label="$t('pages.play.draft_rooms.format_label')"
        />
        <WatchSegmented
          v-model="mode"
          :options="modeOptions"
          :label="$t('pages.play.draft_rooms.host_bar.draft')"
        />
        <WatchSegmented
          v-model="access"
          :options="accessOptions"
          :label="$t('pages.play.draft_rooms.host_bar.access')"
        />
      </div>

      <div class="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          class="hit h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          @click="allSettings"
        >
          <Settings2 class="size-3.5" />
          {{ $t("pages.play.draft_rooms.host_bar.all_settings") }}
        </Button>
        <span
          v-if="locked"
          class="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground"
        >
          <Lock class="size-3.5" />
          {{ $t("draft_games.leader_required") }}
        </span>
        <Button
          v-else-if="myRoom"
          variant="outline"
          size="sm"
          class="hit h-8"
          @click="navigateTo(`/draft-room/${myRoom.id}`)"
        >
          {{ $t("pages.play.draft_rooms.host_bar.back_to_room") }}
        </Button>
        <Button
          v-else
          size="sm"
          class="hit h-8 gap-1.5 px-3.5 text-[13px] font-semibold bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
          @click="host"
        >
          <template v-if="auth.me">
            <Play class="size-3.5 fill-current" />
            {{
              $t("pages.play.draft_rooms.host_bar.open", {
                format: formatLabel(type),
              })
            }}
          </template>
          <template v-else>
            {{ $t("pages.play.draft_rooms.host_bar.sign_in") }}
          </template>
        </Button>
      </div>
    </div>

    <div
      class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground"
    >
      <span>
        {{ $t(`pages.play.draft_rooms.host_bar.phrase.${mode.toLowerCase()}`) }}
      </span>
      <button
        v-if="rehostDetail && !locked && !myRoom && auth.me"
        type="button"
        :class="linkClasses"
        :disabled="rehosting"
        :title="$t('draft_games.rehost_hint')"
        @click="rehost"
      >
        <RotateCcw class="size-3" />
        {{ $t("pages.play.draft_rooms.rehost") }}
        <span class="font-medium text-foreground">· {{ rehostDetail }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.hit {
  position: relative;
}
@media (pointer: coarse) {
  .hit::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: max(100%, 2.75rem);
    transform: translateY(-50%);
  }
}
</style>
