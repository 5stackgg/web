<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  ChevronDown,
  ChevronUp,
  Download,
  GripVertical,
  ListOrdered,
  Map as MapIcon,
  Plus,
  Shuffle,
  TriangleAlert,
  X,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { toast } from "@/components/ui/toast";

type RotationMap = {
  id: string;
  name: string;
  label: string | null;
  poster: string | null;
  workshop_map_id: string | null;
};

const props = defineProps<{ serverId: string; enabled?: boolean }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

// Raw documents: server_map_rotation, map_rotation and these actions are newer
// than ~/generated/zeus until codegen runs against a migrated database.
const QUERY = gql`
  query ServerMapRotation($serverId: uuid!) {
    servers_by_pk(id: $serverId) {
      id
      map_rotation_shuffle
      plugin_overrides(where: { enabled: { _eq: false } }) {
        plugin_slug
      }
      map_rotation(
        where: { map: { deleted_at: { _is_null: true } } }
        order_by: { position: asc }
      ) {
        map {
          id
          name
          label
          poster
          workshop_map_id
        }
      }
    }
    maps(
      where: { deleted_at: { _is_null: true } }
      order_by: [{ label: asc_nulls_last }, { name: asc }]
    ) {
      id
      name
      label
      poster
      workshop_map_id
      type
    }
    game_plugin_installs(
      where: {
        enabled: { _eq: true }
        plugin: { map_rotation: { _is_null: false } }
      }
      order_by: { plugin_slug: asc }
    ) {
      plugin {
        slug
        name
        install_state
      }
    }
  }
`;

const SAVE = gql`
  mutation SetServerMapRotation(
    $serverId: uuid!
    $mapIds: [uuid!]!
    $shuffle: Boolean!
  ) {
    setServerMapRotation(
      server_id: $serverId
      map_ids: $mapIds
      shuffle: $shuffle
    ) {
      success
    }
  }
`;

const IMPORT = gql`
  mutation ImportWorkshopCollection($collection: String!) {
    importWorkshopCollection(collection: $collection) {
      skipped
      maps {
        id
        name
        label
        poster
        workshop_map_id
      }
    }
  }
`;

const { result, refetch } = useQuery(
  QUERY,
  () => ({ serverId: props.serverId }),
  { fetchPolicy: "cache-and-network" },
);

const entries = ref<Array<RotationMap>>([]);
const shuffle = ref(true);
const dirty = ref(false);
const revision = ref(0);
const submitting = ref(false);
const importing = ref(false);
const selectedMapId = ref<string | undefined>();
const collection = ref("");
const brokenPosters = ref(new Set<string>());

const mapKey = (map: RotationMap) => map.workshop_map_id || map.name;
const mapLabel = (map: RotationMap) => map.label || map.name;

function reset() {
  const server = (result.value as any)?.servers_by_pk;

  entries.value = (server?.map_rotation ?? []).map(
    (row: { map: RotationMap }) => row.map,
  );
  shuffle.value = server?.map_rotation_shuffle ?? true;
  dirty.value = false;
}

watch(
  result,
  () => {
    if (!dirty.value) {
      reset();
    }
  },
  { immediate: true },
);

// The catalog holds one row per map per match type; a rotation only cares
// about the map, so each is offered once.
const catalog = computed(() => {
  const taken = new Set(entries.value.map(mapKey));
  const seen = new Set<string>();
  const maps: Array<RotationMap> = [];

  for (const map of (result.value as any)?.maps ?? []) {
    const key = mapKey(map);

    if (taken.has(key) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    maps.push(map);
  }

  return {
    official: maps.filter((map) => !map.workshop_map_id),
    workshop: maps.filter((map) => map.workshop_map_id),
  };
});

// Mirrors the api: the first enabled, installed plugin that declares
// map_rotation runs the rotation, unless this server switched it off.
const rotationPlugin = computed(() => {
  const off = new Set(
    ((result.value as any)?.servers_by_pk?.plugin_overrides ?? []).map(
      (override: { plugin_slug: string }) => override.plugin_slug,
    ),
  );

  return ((result.value as any)?.game_plugin_installs ?? [])
    .map((install: { plugin: any }) => install.plugin)
    .find(
      (plugin: { slug: string; install_state: string }) =>
        ["Installed", "Partial"].includes(plugin.install_state) &&
        !off.has(plugin.slug),
    );
});

const warnWorkshopOrder = computed(
  () =>
    !shuffle.value &&
    rotationPlugin.value?.slug === "map-chooser" &&
    entries.value.some((map) => map.workshop_map_id),
);

const orderModel = computed({
  get: () => (shuffle.value ? "shuffle" : "ordered"),
  set: (value: string) => {
    shuffle.value = value === "shuffle";
    touch();
  },
});

const orderOptions = computed(() => [
  {
    key: "shuffle",
    label: t("pages.dedicated_servers.detail.map_rotation.shuffle"),
    icon: Shuffle,
    title: t("pages.dedicated_servers.detail.map_rotation.shuffle"),
    desc: t("pages.dedicated_servers.detail.map_rotation.shuffle_hint"),
  },
  {
    key: "ordered",
    label: t("pages.dedicated_servers.detail.map_rotation.in_order"),
    icon: ListOrdered,
    title: t("pages.dedicated_servers.detail.map_rotation.in_order"),
    desc: t("pages.dedicated_servers.detail.map_rotation.in_order_hint"),
  },
]);

function touch() {
  dirty.value = true;
  revision.value++;
}

function add(map: RotationMap) {
  if (entries.value.some((entry) => mapKey(entry) === mapKey(map))) {
    return;
  }

  entries.value.push(map);
  touch();
}

function addSelected() {
  const map = [...catalog.value.official, ...catalog.value.workshop].find(
    (option) => option.id === selectedMapId.value,
  );

  if (map) {
    add(map);
  }

  selectedMapId.value = undefined;
}

function moveTo(from: number, to: number) {
  if (from === to || to < 0 || to >= entries.value.length) {
    return;
  }

  const [map] = entries.value.splice(from, 1);
  entries.value.splice(to, 0, map);
  touch();
}

function remove(index: number) {
  entries.value.splice(index, 1);
  touch();
}

const dragIndex = ref<number | null>(null);
const overIndex = ref<number | null>(null);

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index;

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    // Firefox refuses to start a drag without payload.
    event.dataTransfer.setData("text/plain", String(index));
  }
}

function onDragEnter(index: number) {
  if (dragIndex.value !== null) {
    overIndex.value = index;
  }
}

function onDrop(index: number) {
  const from = dragIndex.value;

  dragIndex.value = null;
  overIndex.value = null;

  if (from !== null) {
    moveTo(from, index);
  }
}

function onDragEnd() {
  dragIndex.value = null;
  overIndex.value = null;
}

function posterFailed(map: RotationMap) {
  brokenPosters.value = new Set([...brokenPosters.value, mapKey(map)]);
}

function hasPoster(map: RotationMap) {
  return !!map.poster && !brokenPosters.value.has(mapKey(map));
}

async function importCollection() {
  if (!collection.value.trim() || importing.value) {
    return;
  }

  importing.value = true;

  let imported;

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: IMPORT,
      variables: { collection: collection.value.trim() },
    });

    imported = data?.importWorkshopCollection;
  } finally {
    importing.value = false;
  }

  if (!imported) {
    return;
  }

  for (const map of imported.maps) {
    add(map);
  }

  collection.value = "";

  toast({
    title: t("pages.dedicated_servers.detail.map_rotation.imported", {
      count: imported.maps.length,
    }),
    description: imported.skipped
      ? t("pages.dedicated_servers.detail.map_rotation.imported_skipped", {
          count: imported.skipped,
        })
      : undefined,
  });

  await refetch();
}

async function save() {
  if (submitting.value) {
    return;
  }

  submitting.value = true;
  const startedAt = revision.value;

  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: SAVE,
      variables: {
        serverId: props.serverId,
        mapIds: entries.value.map((map) => map.id),
        shuffle: shuffle.value,
      },
    });

    toast({
      title: t(
        props.enabled === false
          ? "pages.dedicated_servers.detail.map_rotation.saved_disabled"
          : "pages.dedicated_servers.detail.map_rotation.saved",
      ),
    });

    // Changes made while the server was restarting stay pending.
    if (revision.value === startedAt) {
      dirty.value = false;
      await refetch();
    }
  } finally {
    submitting.value = false;
  }
}

const cardClasses =
  "relative isolate overflow-hidden rounded-lg border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.2)_0%,hsl(var(--card)/0.04)_100%)]";

const microLabelClasses =
  "font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground";

const chipClasses =
  "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase leading-none tracking-[0.12em]";
</script>

<template>
  <section>
    <div class="mb-3 flex items-center gap-3">
      <div
        class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("pages.dedicated_servers.detail.map_rotation.title") }}
      </div>
      <span class="h-px flex-1 bg-border" />
      <span :class="microLabelClasses">
        {{ $t("pages.dedicated_servers.detail.map_rotation.maps") }}
        <span class="ml-1 tabular-nums text-foreground">{{
          entries.length
        }}</span>
      </span>
    </div>

    <div :class="cardClasses">
      <div
        class="flex items-start justify-between gap-4 border-b border-border/60 p-4 max-sm:flex-col"
      >
        <p class="max-w-prose text-sm text-muted-foreground">
          {{ $t("pages.dedicated_servers.detail.map_rotation.description") }}
        </p>
        <AnimatedFilters
          v-model="orderModel"
          square
          class="shrink-0"
          :options="orderOptions"
        />
      </div>

      <div
        v-if="rotationPlugin"
        class="flex items-center gap-2 border-b border-border/60 px-4 py-2.5"
      >
        <span
          class="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_hsl(var(--success)/0.8)]"
        />
        <NuxtLink
          :to="`/plugins/${rotationPlugin.slug}`"
          :class="[microLabelClasses, 'hover:text-foreground']"
        >
          {{
            $t("pages.dedicated_servers.detail.map_rotation.played_by", {
              plugin: rotationPlugin.name,
            })
          }}
        </NuxtLink>
      </div>
      <div
        v-else
        class="flex items-center gap-3 border-b border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-4 py-2.5 text-sm text-[hsl(var(--tac-amber))] max-sm:flex-col max-sm:items-start"
      >
        <TriangleAlert class="h-4 w-4 shrink-0 max-sm:hidden" />
        <span class="flex-1">
          {{ $t("pages.dedicated_servers.detail.map_rotation.no_plugin") }}
        </span>
        <Button as-child variant="outline" size="sm" class="shrink-0">
          <NuxtLink to="/plugins/map-chooser">
            {{
              $t("pages.dedicated_servers.detail.map_rotation.install_plugin")
            }}
          </NuxtLink>
        </Button>
      </div>

      <Transition
        enter-active-class="transition-opacity duration-200 motion-reduce:transition-none"
        leave-active-class="transition-opacity duration-150 motion-reduce:transition-none"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="warnWorkshopOrder"
          class="flex items-start gap-2 border-b border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-4 py-2.5 text-xs text-[hsl(var(--tac-amber))]"
        >
          <TriangleAlert class="mt-px h-3.5 w-3.5 shrink-0" />
          {{
            $t("pages.dedicated_servers.detail.map_rotation.workshop_order_hint")
          }}
        </div>
      </Transition>

      <div class="p-3">
        <TransitionGroup
          v-if="entries.length"
          tag="ol"
          class="flex flex-col gap-1.5"
          enter-active-class="rotation-row-fold"
          enter-from-class="rotation-row-collapsed"
          leave-active-class="rotation-row-fold"
          leave-to-class="rotation-row-collapsed"
          move-class="rotation-row-move"
        >
          <li
            v-for="(map, index) in entries"
            :key="mapKey(map)"
            class="grid grid-rows-[1fr]"
            draggable="true"
            @dragstart="onDragStart(index, $event)"
            @dragenter="onDragEnter(index)"
            @dragover.prevent
            @drop.prevent="onDrop(index)"
            @dragend="onDragEnd"
          >
            <div class="min-h-0">
              <div
                :class="[
                  'group flex items-center gap-3 rounded-md border border-border/60 bg-background/40 p-1.5 pr-2 transition-[opacity,border-color,box-shadow] hover:border-border',
                  dragIndex === index ? 'opacity-40' : '',
                  overIndex === index && dragIndex !== index
                    ? 'border-[hsl(var(--tac-amber)/0.7)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.35)]'
                    : '',
                ]"
              >
                <GripVertical
                  class="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 transition-colors group-hover:text-muted-foreground active:cursor-grabbing sm:block"
                />
                <div class="flex shrink-0 flex-col sm:hidden">
                  <button
                    type="button"
                    class="flex h-4 w-5 items-center justify-center text-muted-foreground/70 disabled:opacity-25"
                    :disabled="index === 0"
                    :aria-label="
                      $t('pages.dedicated_servers.detail.map_rotation.move_up')
                    "
                    @click="moveTo(index, index - 1)"
                  >
                    <ChevronUp class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    class="flex h-4 w-5 items-center justify-center text-muted-foreground/70 disabled:opacity-25"
                    :disabled="index === entries.length - 1"
                    :aria-label="
                      $t('pages.dedicated_servers.detail.map_rotation.move_down')
                    "
                    @click="moveTo(index, index + 1)"
                  >
                    <ChevronDown class="h-3.5 w-3.5" />
                  </button>
                </div>

                <span
                  :class="[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border font-mono text-xs font-bold tabular-nums transition-colors',
                    index === 0 && !shuffle
                      ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                      : 'border-border bg-muted/30 text-muted-foreground',
                  ]"
                >
                  {{ index + 1 }}
                </span>

                <div
                  class="relative h-10 w-[4.5rem] shrink-0 overflow-hidden rounded-sm bg-muted/40"
                >
                  <img
                    v-if="hasPoster(map)"
                    :src="map.poster!"
                    alt=""
                    loading="lazy"
                    class="h-full w-full object-cover"
                    @error="posterFailed(map)"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center text-muted-foreground/40"
                  >
                    <MapIcon class="h-4 w-4" />
                  </div>
                  <div
                    class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">
                    {{ mapLabel(map) }}
                  </p>
                  <div class="mt-0.5 flex items-center gap-1.5">
                    <span
                      v-if="map.workshop_map_id"
                      :class="[
                        chipClasses,
                        'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]',
                      ]"
                    >
                      {{
                        $t("pages.dedicated_servers.detail.map_rotation.workshop")
                      }}
                    </span>
                    <span
                      v-if="index === 0 && !shuffle"
                      :class="[
                        chipClasses,
                        'border-border/70 bg-muted/35 text-muted-foreground',
                      ]"
                    >
                      {{
                        $t(
                          "pages.dedicated_servers.detail.map_rotation.boots_first",
                        )
                      }}
                    </span>
                    <span
                      class="truncate font-mono text-[0.62rem] text-muted-foreground/70"
                    >
                      {{ map.workshop_map_id || map.name }}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive [&_svg]:size-3.5"
                  :aria-label="
                    $t('pages.dedicated_servers.detail.map_rotation.remove')
                  "
                  @click="remove(index)"
                >
                  <X />
                </Button>
              </div>
            </div>
          </li>
        </TransitionGroup>

        <div
          v-else
          class="flex flex-col items-center gap-2 rounded-md border border-dashed border-border/70 px-6 py-8 text-center"
        >
          <MapIcon class="h-6 w-6 text-muted-foreground/50" />
          <p class="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]">
            {{ $t("pages.dedicated_servers.detail.map_rotation.empty_title") }}
          </p>
          <p class="max-w-sm text-sm text-muted-foreground">
            {{ $t("pages.dedicated_servers.detail.map_rotation.empty") }}
          </p>
        </div>
      </div>

      <div
        class="grid gap-4 border-t border-border/60 bg-background/20 p-4 md:grid-cols-2"
      >
        <div class="space-y-2">
          <p :class="microLabelClasses">
            {{ $t("pages.dedicated_servers.detail.map_rotation.from_catalog") }}
          </p>
          <div class="flex gap-2">
            <Select v-model="selectedMapId">
              <SelectTrigger class="min-w-0 flex-1">
                <SelectValue
                  :placeholder="
                    $t('pages.dedicated_servers.detail.map_rotation.add_map')
                  "
                />
              </SelectTrigger>
              <SelectContent class="max-h-[300px]">
                <SelectGroup v-if="catalog.official.length">
                  <SelectLabel>
                    {{
                      $t("pages.dedicated_servers.detail.map_rotation.official")
                    }}
                  </SelectLabel>
                  <SelectItem
                    v-for="map in catalog.official"
                    :key="map.id"
                    :value="map.id"
                  >
                    {{ mapLabel(map) }}
                  </SelectItem>
                </SelectGroup>
                <SelectGroup v-if="catalog.workshop.length">
                  <SelectLabel>
                    {{
                      $t("pages.dedicated_servers.detail.map_rotation.workshop")
                    }}
                  </SelectLabel>
                  <SelectItem
                    v-for="map in catalog.workshop"
                    :key="map.id"
                    :value="map.id"
                  >
                    {{ mapLabel(map) }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              class="shrink-0 gap-2"
              :disabled="!selectedMapId"
              @click="addSelected"
            >
              <Plus class="h-4 w-4" />
              {{ $t("pages.dedicated_servers.detail.map_rotation.add") }}
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <p :class="microLabelClasses">
            {{ $t("pages.dedicated_servers.detail.map_rotation.from_workshop") }}
          </p>
          <div class="flex gap-2">
            <Input
              v-model="collection"
              class="min-w-0 flex-1"
              :placeholder="
                $t(
                  'pages.dedicated_servers.detail.map_rotation.import_placeholder',
                )
              "
              @keydown.enter.prevent="importCollection"
            />
            <Button
              variant="outline"
              class="shrink-0 gap-2"
              :disabled="!collection.trim() || importing"
              @click="importCollection"
            >
              <Download class="h-4 w-4" />
              {{ $t("pages.dedicated_servers.detail.map_rotation.import") }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ $t("pages.dedicated_servers.detail.map_rotation.import_hint") }}
          </p>
        </div>
      </div>

      <SettingsSaveBar
        contained
        :dirty="dirty"
        :submitting="submitting"
        :description="$t('pages.dedicated_servers.detail.restart_hint')"
        :action-label="$t('pages.dedicated_servers.detail.save_restart')"
        @save="save"
        @discard="reset"
      />
    </div>
  </section>
</template>

<style scoped>
.rotation-row-fold {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}
.rotation-row-fold > * {
  overflow: hidden;
}
.rotation-row-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}
.rotation-row-move {
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .rotation-row-fold,
  .rotation-row-move {
    transition-duration: 1ms;
  }
}
</style>
