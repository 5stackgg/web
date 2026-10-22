<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowRight, Lock, Play, Settings2 } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import Fold from "~/components/ui/transitions/Fold.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { signInWithSteam } from "~/utilities/loginLinks";
import {
  HOST_ACCESS,
  HOST_MODES,
  HOST_TYPES,
  formatLabel,
  hostChoices,
  hostModes,
  quickHostPayload,
  readRehostPreset,
  rememberHostChoices,
  type HostAccess,
  type HostMode,
} from "~/components/play/draftHost";

// The split Host a room button in the Draft rooms header, and the choices
// its settings half folds open under the header. Both sit in the header's
// grid (areas "split" and "fold"), so the root adds no box of its own.
const props = defineProps<{
  // In a party someone else leads: only the leader hosts for the party.
  locked: boolean;
}>();

const { t } = useI18n();
const auth = useAuthStore();
const draftGames = useDraftGamesStore();
const matchmaking = useMatchmakingStore();

const remembered = hostChoices(readRehostPreset());
const type = ref(remembered.type);
const pickedMode = ref<HostMode>(remembered.mode);
const access = ref<HostAccess>(remembered.access);

// Picking a duel forces auto-split without forgetting the draft style picked
// for the bigger formats.
const duel = computed(() => hostModes(type.value).length === 1);
const mode = computed<HostMode>({
  get: () => (duel.value ? hostModes(type.value)[0] : pickedMode.value),
  set: (value) => (pickedMode.value = value),
});

const typeOptions = HOST_TYPES.map((option) => ({
  key: option.type,
  label: formatLabel(option.type),
}));
const modeOptions = computed(() =>
  HOST_MODES.map((key) => ({
    key,
    label: t(`pages.play.draft_rooms.types.${key.toLowerCase()}`),
    disabled: !hostModes(type.value).includes(key),
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
const hostsOnLan = computed(
  () => matchmaking.onLan && matchmaking.playWhere === "lan",
);

const myRoom = computed(() => draftGames.myDraftGame as any);
const canHost = computed(() => !!auth.me && !props.locked && !myRoom.value);

const open = ref(false);
watch(canHost, (can) => {
  if (!can) open.value = false;
});

// Choices stick for the next visit as soon as they change.
watch([type, mode, access], () =>
  rememberHostChoices(
    { type: type.value, mode: mode.value, access: access.value },
    regions.value.map((region) => region.value),
  ),
);

async function host(event: MouseEvent) {
  if (
    !(await matchmaking.ensurePlayWhere(
      "room",
      event.currentTarget as HTMLElement,
    ))
  ) {
    return;
  }
  try {
    const draftGameId = await draftGames.create(
      quickHostPayload({
        type: type.value,
        mode: mode.value,
        access: access.value,
        regions: regions.value.map((region) => region.value),
      }),
    );
    if (draftGameId) {
      await navigateTo(`/draft-room/${draftGameId}`);
    }
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message ?? t("common.error"),
    });
  }
}

const amberClasses =
  "bg-[hsl(var(--tac-amber))] text-[13px] font-semibold text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]";
const segmentedClasses =
  "max-sm:w-full max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center";
const linkClasses =
  "hit inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";
</script>

<template>
  <div class="contents">
    <!-- Phones: full width under the title, 40px tall. -->
    <div class="flex [grid-area:split] max-lg:mt-3 max-lg:w-full">
      <span
        v-if="locked"
        class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground max-lg:flex-1 lg:h-8"
      >
        <Lock class="size-3.5" />
        {{ $t("draft_games.leader_required") }}
      </span>
      <Button
        v-else-if="myRoom"
        variant="outline"
        size="sm"
        class="hit h-10 max-lg:flex-1 lg:h-8"
        @click="navigateTo(`/draft-room/${myRoom.id}`)"
      >
        {{ $t("pages.play.draft_rooms.host_bar.back_to_room") }}
      </Button>
      <Button
        v-else-if="!auth.me"
        size="sm"
        :class="[amberClasses, 'hit h-10 px-3.5 max-lg:flex-1 lg:h-8']"
        @click="signInWithSteam"
      >
        {{ $t("pages.play.draft_rooms.host_bar.sign_in") }}
      </Button>
      <template v-else>
        <Button
          size="sm"
          :class="[
            amberClasses,
            'hit h-10 gap-1.5 rounded-r-none px-3.5 max-lg:flex-1 lg:h-8',
          ]"
          @click="host"
        >
          <Play class="size-3.5 fill-current" />
          {{
            $t(
              hostsOnLan
                ? "pages.play.draft_rooms.host_bar.host_lan"
                : "pages.play.draft_rooms.host_bar.title",
            )
          }}
        </Button>
        <Button
          size="icon"
          :class="[
            amberClasses,
            'hit choices-toggle h-10 w-[46px] shrink-0 rounded-l-none border-l border-[hsl(var(--tac-amber-foreground)/0.35)] lg:h-8 lg:w-[34px]',
          ]"
          :aria-expanded="open"
          :aria-label="$t('pages.play.draft_rooms.host_bar.choices')"
          @click="open = !open"
          @keydown.escape="open = false"
        >
          <Settings2 class="size-4" />
        </Button>
      </template>
    </div>

    <div class="[grid-area:fold]">
      <Fold :open="open && canHost">
        <div
          class="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-lg border border-border bg-muted/25 p-3.5 lg:mt-3"
          @keydown.escape="open = false"
        >
          <div class="flex min-w-0 flex-wrap gap-x-6 gap-y-3.5 max-sm:w-full">
            <div class="grid min-w-0 content-start gap-1.5 max-sm:w-full">
              <span class="text-xs font-medium text-muted-foreground">
                {{ $t("pages.play.draft_rooms.format_label") }}
              </span>
              <WatchSegmented
                v-model="type"
                :options="typeOptions"
                :label="$t('pages.play.draft_rooms.format_label')"
                :class="segmentedClasses"
              />
            </div>
            <div class="grid min-w-0 content-start gap-1.5 max-sm:w-full">
              <span class="text-xs font-medium text-muted-foreground">
                {{ $t("pages.play.draft_rooms.host_bar.draft") }}
              </span>
              <WatchSegmented
                v-model="mode"
                :options="modeOptions"
                :label="$t('pages.play.draft_rooms.host_bar.draft')"
                :class="segmentedClasses"
              />
              <!-- Sized by the strip above, so a longer line wraps instead
                   of pushing the next group along. -->
              <span
                class="w-0 min-w-full text-xs text-muted-foreground/70 [text-wrap:pretty]"
              >
                {{
                  $t(
                    `pages.play.draft_rooms.host_bar.phrase.${duel ? "duel" : mode.toLowerCase()}`,
                  )
                }}
              </span>
            </div>
            <div class="grid min-w-0 content-start gap-1.5 max-sm:w-full">
              <span class="text-xs font-medium text-muted-foreground">
                {{ $t("pages.play.draft_rooms.host_bar.access") }}
              </span>
              <WatchSegmented
                v-model="access"
                :options="accessOptions"
                :label="$t('pages.play.draft_rooms.host_bar.access')"
                :class="segmentedClasses"
              />
            </div>
          </div>
          <button
            type="button"
            :class="linkClasses"
            @click="navigateTo('/draft-room/create')"
          >
            {{ $t("pages.play.draft_rooms.host_bar.all_settings") }}
            <ArrowRight class="size-3" />
          </button>
        </div>
      </Fold>
    </div>
  </div>
</template>

<style scoped>
/* While the choices are open the settings half reads as held down. */
.choices-toggle[aria-expanded="true"] {
  background-color: color-mix(in hsl, hsl(var(--tac-amber)), black 18%);
  box-shadow: inset 0 1px 3px hsl(var(--tac-amber-foreground) / 0.45);
}

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
