<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { ArrowDown, ArrowUp, Download, Plus, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
      map_rotation(order_by: { position: asc }) {
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
    game_plugins(
      where: { map_rotation: { _is_null: false } }
      order_by: { slug: asc }
    ) {
      slug
      name
      install_state
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
const selectedMapId = ref<string | undefined>();
const collection = ref("");

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

// Mirrors the api: the first installed plugin that declares map_rotation runs
// the rotation when the server does not already load one.
const rotationPlugin = computed(() =>
  ((result.value as any)?.game_plugins ?? []).find(
    (plugin: { install_state: string }) =>
      plugin.install_state !== "NotInstalled",
  ),
);

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

  entries.value.push(map);
  dirty.value = true;
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

function move(index: number, by: number) {
  const target = index + by;

  if (target < 0 || target >= entries.value.length) {
    return;
  }

  const [map] = entries.value.splice(index, 1);
  entries.value.splice(target, 0, map);
  dirty.value = true;
}

function remove(index: number) {
  entries.value.splice(index, 1);
  dirty.value = true;
}

function setShuffle(value: boolean) {
  shuffle.value = value;
  dirty.value = true;
}

async function importCollection() {
  if (!collection.value.trim()) {
    return;
  }

  const { data } = await nuxtApp.$apollo.defaultClient.mutate({
    mutation: IMPORT,
    variables: { collection: collection.value.trim() },
  });

  const imported = data?.importWorkshopCollection;

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
  await nuxtApp.$apollo.defaultClient.mutate({
    mutation: SAVE,
    variables: {
      serverId: props.serverId,
      mapIds: entries.value.map((map) => map.id),
      shuffle: shuffle.value,
    },
  });

  dirty.value = false;

  toast({ title: t("pages.dedicated_servers.detail.map_rotation.saved") });

  await refetch();
}
</script>

<template>
  <div>
    <div
      class="mb-3 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
    >
      <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
      {{ $t("pages.dedicated_servers.detail.map_rotation.title") }}
    </div>

    <div class="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div class="flex items-start justify-between gap-4 max-sm:flex-col">
        <p class="text-sm text-muted-foreground">
          {{ $t("pages.dedicated_servers.detail.map_rotation.description") }}
        </p>
        <div class="flex shrink-0 items-center gap-2">
          <Switch :model-value="shuffle" @update:model-value="setShuffle" />
          <div class="space-y-0.5">
            <p class="text-sm">
              {{ $t("pages.dedicated_servers.detail.map_rotation.shuffle") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{
                $t("pages.dedicated_servers.detail.map_rotation.shuffle_hint")
              }}
            </p>
          </div>
        </div>
      </div>

      <p
        v-if="rotationPlugin"
        class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{
          $t("pages.dedicated_servers.detail.map_rotation.played_by", {
            plugin: rotationPlugin.name,
          })
        }}
      </p>
      <div
        v-else
        class="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-3 py-2 text-sm text-[hsl(var(--tac-amber))] max-sm:flex-col max-sm:items-start"
      >
        <span>
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

      <p
        v-if="warnWorkshopOrder"
        class="rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-3 py-2 text-xs text-[hsl(var(--tac-amber))]"
      >
        {{
          $t("pages.dedicated_servers.detail.map_rotation.workshop_order_hint")
        }}
      </p>

      <ol v-if="entries.length" class="divide-y divide-border/60">
        <li
          v-for="(map, index) in entries"
          :key="mapKey(map)"
          class="flex items-center gap-3 py-2"
        >
          <span
            class="w-6 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-muted-foreground"
          >
            {{ index + 1 }}
          </span>
          <img
            v-if="map.poster"
            :src="map.poster"
            alt=""
            class="h-8 w-14 shrink-0 rounded-sm object-cover"
          />
          <span v-else class="h-8 w-14 shrink-0 rounded-sm bg-muted" />
          <span class="min-w-0 flex-1 truncate text-sm">
            {{ mapLabel(map) }}
          </span>
          <span
            v-if="map.workshop_map_id"
            class="inline-flex items-center rounded border border-border/70 bg-muted/35 px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground max-sm:hidden"
          >
            {{ $t("pages.dedicated_servers.detail.map_rotation.workshop") }}
          </span>
          <div class="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 [&_svg]:size-3.5"
              :disabled="index === 0"
              :aria-label="
                $t('pages.dedicated_servers.detail.map_rotation.move_up')
              "
              @click="move(index, -1)"
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 [&_svg]:size-3.5"
              :disabled="index === entries.length - 1"
              :aria-label="
                $t('pages.dedicated_servers.detail.map_rotation.move_down')
              "
              @click="move(index, 1)"
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 [&_svg]:size-3.5"
              :aria-label="
                $t('pages.dedicated_servers.detail.map_rotation.remove')
              "
              @click="remove(index)"
            >
              <X />
            </Button>
          </div>
        </li>
      </ol>
      <p v-else class="text-sm text-muted-foreground">
        {{ $t("pages.dedicated_servers.detail.map_rotation.empty") }}
      </p>

      <div class="grid gap-3 md:grid-cols-2">
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

        <form class="flex gap-2" @submit.prevent="importCollection">
          <Input
            v-model="collection"
            class="min-w-0 flex-1"
            :placeholder="
              $t('pages.dedicated_servers.detail.map_rotation.import_placeholder')
            "
          />
          <Button
            type="button"
            variant="outline"
            class="shrink-0 gap-2"
            :disabled="!collection.trim()"
            @click="importCollection"
          >
            <Download class="h-4 w-4" />
            {{ $t("pages.dedicated_servers.detail.map_rotation.import") }}
          </Button>
        </form>
      </div>

      <div
        class="flex items-center justify-end gap-3 border-t border-border/60 pt-4 max-sm:flex-col max-sm:items-stretch"
      >
        <p class="mr-auto text-xs text-muted-foreground">
          {{ $t("pages.dedicated_servers.detail.restart_hint") }}
        </p>
        <Button v-if="dirty" variant="ghost" @click="reset">
          {{ $t("pages.dedicated_servers.detail.discard") }}
        </Button>
        <Button :disabled="!dirty" @click="save">
          {{ $t("pages.dedicated_servers.detail.save_restart") }}
        </Button>
      </div>
    </div>
  </div>
</template>
