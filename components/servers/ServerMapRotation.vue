<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Map as MapIcon,
  X,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import { toast } from "@/components/ui/toast";

type RotationMap = {
  id: string;
  name: string;
  label: string | null;
  poster: string | null;
  workshop_map_id: string | null;
};

const props = defineProps<{ serverId: string }>();

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
const baseline = ref<{ ids: Array<string>; shuffle: boolean }>({
  ids: [],
  shuffle: true,
});
const importing = ref(false);
const selectedMapId = ref<string | undefined>();
const collection = ref("");
const brokenPosters = ref(new Set<string>());

const mapKey = (map: RotationMap) => map.workshop_map_id || map.name;
const mapLabel = (map: RotationMap) => map.label || map.name;

const changes = computed<Array<{ text: string; restart: boolean }>>(() => {
  const before = baseline.value.ids;
  const after = entries.value.map((map) => map.id);
  const added = after.filter((id) => !before.includes(id)).length;
  const removed = before.filter((id) => !after.includes(id)).length;
  const list: Array<string> = [];

  if (added) {
    list.push(
      t("pages.dedicated_servers.detail.settings.changes.maps_added", {
        count: added,
      }),
    );
  }

  if (removed) {
    list.push(
      t("pages.dedicated_servers.detail.settings.changes.maps_removed", {
        count: removed,
      }),
    );
  }

  if (!added && !removed && after.join() !== before.join()) {
    list.push(t("pages.dedicated_servers.detail.settings.changes.map_order"));
  }

  if (shuffle.value !== baseline.value.shuffle) {
    list.push(
      t(
        shuffle.value
          ? "pages.dedicated_servers.detail.settings.changes.shuffle_on"
          : "pages.dedicated_servers.detail.settings.changes.shuffle_off",
      ),
    );
  }

  return list.map((text) => ({ text, restart: true }));
});

function reset() {
  const server = (result.value as any)?.servers_by_pk;

  entries.value = (server?.map_rotation ?? []).map(
    (row: { map: RotationMap }) => row.map,
  );
  shuffle.value = server?.map_rotation_shuffle ?? true;
  baseline.value = {
    ids: entries.value.map((map) => map.id),
    shuffle: shuffle.value,
  };
}

watch(
  result,
  () => {
    if (!changes.value.length) {
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

function add(map: RotationMap) {
  if (entries.value.some((entry) => mapKey(entry) === mapKey(map))) {
    return;
  }

  entries.value = [...entries.value, map];
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

  const next = [...entries.value];
  const [map] = next.splice(from, 1);
  next.splice(to, 0, map);
  entries.value = next;
}

function remove(index: number) {
  entries.value = entries.value.filter((_, position) => position !== index);
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

function payload() {
  return {
    map_ids: entries.value.map((map) => map.id),
    shuffle: shuffle.value,
  };
}

async function saved() {
  baseline.value = {
    ids: entries.value.map((map) => map.id),
    shuffle: shuffle.value,
  };

  await refetch();
}

defineExpose({ changes, payload, reset, saved });
</script>

<template>
  <div class="grid gap-8">
    <SettingsSection
      id="server-rotation-maps"
      :title="$t('pages.dedicated_servers.detail.map_rotation.maps')"
      :description="$t('pages.dedicated_servers.detail.map_rotation.description')"
    >
      <p
        v-if="!rotationPlugin"
        class="text-sm text-[hsl(var(--tac-amber))]"
      >
        {{ $t("pages.dedicated_servers.detail.map_rotation.no_plugin") }}
        <NuxtLink to="/plugins/map-chooser" class="underline">
          {{ $t("pages.dedicated_servers.detail.map_rotation.install_plugin") }}
        </NuxtLink>
      </p>
      <p
        v-if="warnWorkshopOrder"
        class="text-sm text-[hsl(var(--tac-amber))]"
      >
        {{
          $t("pages.dedicated_servers.detail.map_rotation.workshop_order_hint")
        }}
      </p>

      <TransitionGroup
        v-if="entries.length"
        tag="ol"
        class="overflow-hidden rounded-md border border-border"
        enter-active-class="rotation-row-fold"
        enter-from-class="rotation-row-collapsed"
        leave-active-class="rotation-row-fold"
        leave-to-class="rotation-row-collapsed"
        move-class="rotation-row-move"
      >
        <li
          v-for="(map, index) in entries"
          :key="mapKey(map)"
          class="grid grid-rows-[1fr] border-b border-border/60 last:border-b-0"
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
                'group flex items-center gap-3 px-3 py-2 transition-[opacity,background-color]',
                dragIndex === index ? 'opacity-40' : '',
                overIndex === index && dragIndex !== index
                  ? 'bg-[hsl(var(--tac-amber)/0.06)]'
                  : '',
              ]"
            >
              <GripVertical
                class="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground active:cursor-grabbing sm:block"
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
                class="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground"
              >
                {{ index + 1 }}
              </span>
              <div
                class="h-9 w-16 shrink-0 overflow-hidden rounded-sm bg-muted/40"
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
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ mapLabel(map) }}</p>
                <p class="truncate text-xs text-muted-foreground">
                  <template v-if="map.workshop_map_id">
                    {{
                      $t("pages.dedicated_servers.detail.map_rotation.workshop")
                    }}
                    ·
                    <span class="font-mono">{{ map.workshop_map_id }}</span>
                  </template>
                  <span v-else class="font-mono">{{ map.name }}</span>
                  <template v-if="index === 0 && !shuffle">
                    ·
                    {{
                      $t(
                        "pages.dedicated_servers.detail.map_rotation.boots_first",
                      )
                    }}
                  </template>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 shrink-0 text-muted-foreground [&_svg]:size-3.5"
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
      <p v-else class="text-sm text-muted-foreground">
        {{ $t("pages.dedicated_servers.detail.map_rotation.empty") }}
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="grid gap-2">
          <Label for="rotation-catalog">
            {{ $t("pages.dedicated_servers.detail.map_rotation.from_catalog") }}
          </Label>
          <div class="flex gap-2">
            <Select v-model="selectedMapId">
              <SelectTrigger id="rotation-catalog" class="min-w-0 flex-1">
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
              class="shrink-0"
              :disabled="!selectedMapId"
              @click="addSelected"
            >
              {{ $t("pages.dedicated_servers.detail.map_rotation.add") }}
            </Button>
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="rotation-workshop">
            {{ $t("pages.dedicated_servers.detail.map_rotation.from_workshop") }}
          </Label>
          <div class="flex gap-2">
            <Input
              id="rotation-workshop"
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
              class="shrink-0"
              :disabled="!collection.trim() || importing"
              @click="importCollection"
            >
              {{ $t("pages.dedicated_servers.detail.map_rotation.import") }}
            </Button>
          </div>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection
      id="server-rotation-shuffle"
      :title="$t('pages.dedicated_servers.detail.map_rotation.shuffle')"
      :description="
        $t('pages.dedicated_servers.detail.map_rotation.shuffle_hint')
      "
      clickable-header
      @header-click="shuffle = !shuffle"
    >
      <template #action>
        <Switch
          :model-value="shuffle"
          :aria-label="$t('pages.dedicated_servers.detail.map_rotation.shuffle')"
          @update:model-value="shuffle = $event"
        />
      </template>
    </SettingsSection>
  </div>
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
