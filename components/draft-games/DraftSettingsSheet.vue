<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2, Pencil, Trash2, SlidersHorizontal } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { mapFields } from "~/graphql/mapGraphql";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { HeightSwap } from "~/components/ui/transitions";
import CreateDraftGame from "~/components/draft-games/CreateDraftGame.vue";
import { draftRoomOptions } from "~/components/draft-games/draftRoomHeader";
import mapLabel from "~/utilities/mapLabel";

const props = defineProps<{
  open: boolean;
  room: any;
  match?: any;
  // The edit form, rather than the read-only list everyone gets.
  editing: boolean;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "edit"): void;
}>();

const { t } = useI18n();

const draftGame = ref<any | undefined>(undefined);
const loading = ref(false);
const canceling = ref(false);

const load = async () => {
  loading.value = true;
  draftGame.value = undefined;
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      draft_games_by_pk: [
        { id: $("id", "uuid!") },
        {
          id: true,
          host_steam_id: true,
          status: true,
          mode: true,
          access: true,
          type: true,
          regions: true,
          map_pool_id: true,
          team_1_id: true,
          team_2_id: true,
          inner_squad: true,
          team_1: {
            id: true,
            name: true,
          },
          team_2: {
            id: true,
            name: true,
          },
          players: [
            {},
            {
              steam_id: true,
              lineup: true,
            },
          ],
          captain_selection: true,
          draft_order: true,
          require_approval: true,
          min_elo: true,
          max_elo: true,
          options: {
            ...matchOptionsFields,
          },
        },
      ],
    }),
    variables: {
      id: props.room.id,
    },
  });
  draftGame.value = data.draft_games_by_pk;
  loading.value = false;
};

const opts = computed(() => draftRoomOptions(props.room, props.match));

// A quick-hosted room names no maps: the api plays its own pool, or the
// seeded one for the type, so the sheet asks for those maps when it opens.
const fetchedMaps = ref<Array<any> | null>(null);
const knownMaps = computed<Array<any> | null>(
  () => opts.value.map_pool?.maps ?? null,
);
const maps = computed(() => knownMaps.value ?? fetchedMaps.value ?? []);

const loadPoolMaps = async () => {
  if (knownMaps.value || fetchedMaps.value) {
    return;
  }
  const poolId = props.room.map_pool_id;
  const type = ["Premier", "Faceit"].includes(props.room.type)
    ? "Competitive"
    : props.room.type;
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      map_pools: [
        {
          where: poolId
            ? { id: { _eq: $("id", "uuid!") } }
            : {
                type: { _eq: $("type", "e_map_pool_types_enum!") },
                seed: { _eq: true },
                enabled: { _eq: true },
              },
          limit: 1,
        },
        {
          id: true,
          maps: [{}, mapFields],
        },
      ],
    }),
    variables: poolId ? { id: poolId } : { type },
  });
  fetchedMaps.value = data.map_pools[0]?.maps ?? [];
};

watch(
  () => [props.open, props.editing] as const,
  ([open, editing]) => {
    if (!open) {
      return;
    }
    if (editing) {
      load();
      return;
    }
    loadPoolMaps().catch(() => {});
  },
);

const onSaved = () => {
  emit("close");
};

const cancelDraft = () => {
  if (canceling.value) {
    return;
  }
  canceling.value = true;
  useDraftGamesStore().cancelDraftRoom(props.room.id);
};

const MODE_LABEL: Record<string, string> = {
  Captains: "pages.play.draft_rooms.types.captains",
  Host: "pages.play.draft_rooms.types.host",
  Pug: "pages.play.draft_rooms.types.pug",
  Teams: "pages.play.draft_rooms.types.teams",
};

const CAPTAIN_SELECTION: Record<string, string> = {
  TopEloTwo: "draft_games.captain_selection.top_elo_two",
  HostAndNext: "draft_games.captain_selection.host_and_next",
  RandomTwo: "draft_games.captain_selection.random_two",
  Manual: "draft_games.captain_selection.manual",
};

const DRAFT_ORDER: Record<string, string> = {
  Snake: "draft_games.draft_order.snake",
  Alternating: "draft_games.draft_order.alternating",
  FrontLoaded: "draft_games.draft_order.front_loaded",
};

// One line on how the sides get made. A captains draft says exactly how: who
// captains and in what order they pick.
const modeDetail = computed(() => {
  const room = props.room;
  if (room.mode === "Pug") {
    return t("draft_games.mode.pug_desc");
  }
  if (room.mode === "Host") {
    return t("draft_games.room.host_mode_desc");
  }
  if (room.mode === "Teams") {
    return t("draft_games.mode.teams_desc");
  }
  return [
    CAPTAIN_SELECTION[room.captain_selection],
    DRAFT_ORDER[room.draft_order],
  ]
    .filter(Boolean)
    .map((key) => t(key as string))
    .join(" · ");
});

const ACCESS: Record<string, string> = {
  Open: "open",
  Friends: "friends",
  Invite: "invite",
  Private: "private",
};
const access = computed(() => ACCESS[props.room.access] || ACCESS.Open);

const onOff = (value: any) =>
  value ? t("draft_games.bar.on") : t("draft_games.bar.off");

const regions = computed<Array<string>>(() => props.room.regions || []);

const rows = computed(() => {
  const o = opts.value;
  const room = props.room;
  return [
    ...(o.game_mode
      ? [
          {
            key: "game_mode",
            label: t("draft_games.bar.game_mode"),
            value: `${o.game_mode.name} · ${t("draft_games.bar.unranked")}`,
          },
        ]
      : []),
    { key: "type", label: t("match.tabs.type"), value: room.type },
    { key: "rounds", label: t("match.tabs.rounds"), value: `MR${o.mr}` },
    {
      key: "best_of",
      label: t("draft_games.bar.best_of"),
      value: String(o.best_of ?? 1),
    },
    {
      key: "region",
      label: t("draft_games.bar.region"),
      value:
        regions.value.length === 1
          ? regions.value[0]
          : t("draft_games.bar.region_veto"),
    },
  ];
});

const toggles = computed(() => {
  const o = opts.value;
  return [
    { key: "overtime", label: t("draft_games.bar.overtime"), on: !!o.overtime },
    { key: "knife", label: t("draft_games.bar.knife"), on: !!o.knife_round },
    { key: "veto", label: t("draft_games.bar.map_veto"), on: !!o.map_veto },
    { key: "coaches", label: t("draft_games.bar.coaches"), on: !!o.coaches },
  ];
});

const poolName = computed(
  () => opts.value.map_pool?.type || t("common.default"),
);
</script>

<template>
  <Sheet :open="open" @update:open="(o) => o === false && emit('close')">
    <SheetContent
      class="flex w-full flex-col gap-0 overflow-y-auto border-l-[hsl(var(--tac-amber)/0.25)] transition-[max-width] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      :class="editing ? 'sm:max-w-3xl' : 'sm:max-w-md'"
    >
      <SheetHeader class="border-b border-border/60 pb-4 text-left">
        <div class="flex items-start justify-between gap-3 pr-8">
          <div>
            <SheetTitle
              class="flex items-center gap-2 font-sans text-base font-bold uppercase tracking-[0.18em]"
            >
              <SlidersHorizontal class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
              {{ $t("draft_games.room.match_settings") }}
            </SheetTitle>
            <SheetDescription
              class="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em]"
              :class="{ 'sr-only': !editing }"
            >
              {{
                editing
                  ? $t("draft_games.room.edit_settings")
                  : $t(MODE_LABEL[room.mode] || MODE_LABEL.Captains)
              }}
            </SheetDescription>
          </div>
          <button
            v-if="editing"
            type="button"
            class="cancel-draft"
            :disabled="canceling"
            @click="cancelDraft"
          >
            <Loader2 v-if="canceling" class="h-3.5 w-3.5 animate-spin" />
            <Trash2 v-else class="h-3.5 w-3.5" />
            {{ $t("draft_games.room.cancel_draft") }}
          </button>
        </div>
      </SheetHeader>

      <div class="flex-1 pt-5">
        <!-- Spinner block and the full form are wildly different heights;
             measured swap so the sheet doesn't jolt when the query lands. -->
        <HeightSwap>
          <div
            v-if="editing && loading"
            key="loading"
            class="flex items-center justify-center py-16 text-muted-foreground"
          >
            <Spinner />
          </div>
          <div v-else-if="editing && draftGame" key="form">
            <CreateDraftGame
              :initial="draftGame"
              :editing="true"
              @created="onSaved"
            />
          </div>
          <div v-else-if="!editing" key="view">
            <dl class="settings-list">
              <div>
                <dt>{{ $t("draft_games.create.step_format") }}</dt>
                <dd>{{ $t(MODE_LABEL[room.mode] || MODE_LABEL.Captains) }}</dd>
                <p v-if="modeDetail" class="settings-sub">{{ modeDetail }}</p>
              </div>
              <div>
                <dt>{{ $t("draft_games.create.access") }}</dt>
                <dd>{{ $t(`draft_games.access.${access}`) }}</dd>
                <p class="settings-sub">
                  {{ $t(`draft_games.access.${access}_desc`) }}
                </p>
              </div>
              <div>
                <dt>{{ $t("draft_games.create.require_approval") }}</dt>
                <dd :class="{ 'is-off': !room.require_approval }">
                  {{ onOff(room.require_approval) }}
                </dd>
              </div>
              <div v-if="room.min_elo || room.max_elo">
                <dt>{{ $t("draft_games.create.rank_range") }}</dt>
                <dd class="tabular-nums">
                  {{ room.min_elo || 0 }}–{{ room.max_elo || "∞" }}
                </dd>
              </div>
            </dl>

            <dl class="settings-list mt-6">
              <div v-for="row in rows" :key="row.key">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
              <div>
                <dt>{{ $t("draft_games.bar.pool") }}</dt>
                <dd>
                  {{ poolName }}
                  <span v-if="maps.length" class="tabular-nums">
                    · {{ maps.length }}
                  </span>
                </dd>
                <ul v-if="maps.length" class="map-chips">
                  <li v-for="map in maps" :key="map.id" class="map-chip">
                    {{ mapLabel(map) }}
                  </li>
                </ul>
              </div>
              <div v-for="toggle in toggles" :key="toggle.key">
                <dt>{{ toggle.label }}</dt>
                <dd :class="{ 'is-off': !toggle.on }">
                  {{ onOff(toggle.on) }}
                </dd>
              </div>
            </dl>
          </div>
        </HeightSwap>
      </div>

      <div
        v-if="!editing && canEdit"
        class="sticky bottom-0 -mx-6 -mb-6 mt-6 border-t border-border/60 bg-background px-6 py-4"
      >
        <Button variant="outline" @click="emit('edit')">
          <Pencil />
          {{ $t("draft_games.room.edit_settings") }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.settings-list > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.125rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.6875rem 0;
}
.settings-list dt {
  font-size: 13.5px;
  color: hsl(var(--muted-foreground));
}
.settings-list dd {
  font-size: 13.5px;
  font-weight: 600;
  text-align: right;
}
.settings-list dd.is-off {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}
.settings-sub {
  grid-column: 1 / -1;
  font-size: 12.5px;
  color: hsl(var(--muted-foreground) / 0.8);
  text-wrap: pretty;
}
.map-chips {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
}
.map-chip {
  display: inline-flex;
  height: 1.625rem;
  align-items: center;
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border));
  padding: 0 0.5625rem;
  font-size: 12.5px;
  color: hsl(var(--muted-foreground));
}
.cancel-draft {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.4rem;
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--destructive) / 0.4);
  background: hsl(var(--destructive) / 0.08);
  padding: 0.4rem 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: hsl(var(--destructive));
  cursor: pointer;
  transition: all 0.15s ease;
}
.cancel-draft:hover:not(:disabled) {
  background: hsl(var(--destructive) / 0.16);
  border-color: hsl(var(--destructive) / 0.6);
}
.cancel-draft:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
