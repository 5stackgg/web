<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Map as MapIcon,
  Plus,
  Search,
  X,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
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
const collection = ref("");
const filter = ref("");
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
const available = computed(() => {
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

  return maps;
});

const pool = computed(() => {
  const query = filter.value.trim().toLowerCase();
  const maps = available.value.filter(
    (map) =>
      !query ||
      mapLabel(map).toLowerCase().includes(query) ||
      map.name.toLowerCase().includes(query) ||
      !!map.workshop_map_id?.includes(query),
  );

  return [
    {
      key: "official",
      label: t("pages.dedicated_servers.detail.map_rotation.official"),
      maps: maps.filter((map) => !map.workshop_map_id),
    },
    {
      key: "workshop",
      label: t("pages.dedicated_servers.detail.map_rotation.workshop"),
      maps: maps.filter((map) => map.workshop_map_id),
    },
  ].filter((group) => group.maps.length);
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

function insertAt(index: number, maps: Array<RotationMap>) {
  const taken = new Set(entries.value.map(mapKey));
  const fresh = maps.filter((map) => {
    if (taken.has(mapKey(map))) {
      return false;
    }

    taken.add(mapKey(map));
    return true;
  });

  if (!fresh.length) {
    return;
  }

  const next = [...entries.value];
  next.splice(index, 0, ...fresh);
  entries.value = next;
}

function add(map: RotationMap) {
  insertAt(entries.value.length, [map]);
}

function addAll(maps: Array<RotationMap>) {
  insertAt(entries.value.length, maps);
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

function clear() {
  entries.value = [];
}

const listEl = ref<HTMLElement | null>(null);
const poolEl = ref<HTMLElement | null>(null);

function scrollerOf(element: HTMLElement) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (
      /auto|scroll/.test(getComputedStyle(node).overflowY) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
  }

  return document.scrollingElement as HTMLElement | null;
}

// Adding from the pool grows the list above it, which would slide the next
// tile under the cursor. The scroll is corrected after the DOM patch and
// before the frame paints, so the pool never visibly moves.
async function fromPool(change: () => void) {
  const before = poolEl.value?.getBoundingClientRect().top;

  change();
  await nextTick();

  const after = poolEl.value?.getBoundingClientRect().top;

  if (poolEl.value && before !== undefined && after !== undefined) {
    scrollerOf(poolEl.value)?.scrollBy({ top: after - before });
  }
}

type Drag = {
  from: "rotation" | "pool";
  map: RotationMap;
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  active: boolean;
  settleTo: { x: number; y: number } | null;
};

const drag = ref<Drag | null>(null);
const slot = ref<number | null>(null);
const overPool = ref(false);
const listLock = ref(0);
let rowHeight = 53;
let scrollFrame = 0;
let suppressClickUntil = 0;

// While dragging, the list shows where the map would land: the dragged row
// leaves its old position and a gap opens at `slot`, so TransitionGroup slides
// the rest out of the way as the pointer moves.
const rows = computed(() => {
  const current = drag.value;

  if (!current?.active) {
    return entries.value.map((map) => ({ map, placeholder: false }));
  }

  const rest =
    current.from === "rotation"
      ? entries.value.filter((_, index) => index !== current.index)
      : entries.value;
  const list = rest.map((map) => ({ map, placeholder: false }));

  if (slot.value !== null) {
    list.splice(slot.value, 0, { map: current.map, placeholder: true });
  }

  return list;
});

const ghostTransform = computed(() => {
  const current = drag.value;

  if (!current) {
    return undefined;
  }

  const x = current.settleTo?.x ?? current.x - current.offsetX;
  const y = current.settleTo?.y ?? current.y - current.offsetY;

  return `translate3d(${x}px, ${y}px, 0)`;
});

function pressRow(index: number, event: PointerEvent) {
  if ((event.target as Element).closest("button")) {
    return;
  }

  press({ from: "rotation", map: entries.value[index], index }, event);
}

function pressTile(map: RotationMap, event: PointerEvent) {
  press({ from: "pool", map, index: -1 }, event);
}

// Touch keeps tap-to-add and the arrow buttons; a press on a tile or row has
// to be free to scroll the page there.
function press(
  source: Pick<Drag, "from" | "map" | "index">,
  event: PointerEvent,
) {
  if (event.button !== 0 || event.pointerType === "touch" || drag.value) {
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

  drag.value = {
    ...source,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
    active: false,
    settleTo: null,
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", finishDrag);
  window.addEventListener("keydown", onDragKey);
  window.addEventListener("scroll", track, true);
}

function onPointerMove(event: PointerEvent) {
  const current = drag.value;

  if (!current || event.pointerId !== current.pointerId || current.settleTo) {
    return;
  }

  current.x = event.clientX;
  current.y = event.clientY;

  if (!current.active) {
    if (Math.hypot(current.x - current.startX, current.y - current.startY) < 5) {
      return;
    }

    const row = listEl.value?.querySelector<HTMLElement>("[data-rotation-row]");

    rowHeight = row?.offsetHeight || 53;
    // Held for the whole drag: a list that shrank as the dragged row left it
    // would pull the pool up under the pointer and flip the drop target.
    listLock.value = listEl.value?.offsetHeight ?? 0;
    slot.value = current.from === "rotation" ? current.index : null;
    current.active = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    window.getSelection()?.removeAllRanges();
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  track();
}

function within(rect: DOMRect, x: number, y: number, slackX = 0, slackY = 0) {
  return (
    x >= rect.left - slackX &&
    x <= rect.right + slackX &&
    y >= rect.top - slackY &&
    y <= rect.bottom + slackY
  );
}

function track() {
  const current = drag.value;

  if (!current?.active || current.settleTo) {
    return;
  }

  const pool = poolEl.value?.getBoundingClientRect();

  overPool.value =
    current.from === "rotation" &&
    !!pool &&
    within(pool, current.x, current.y);

  if (overPool.value) {
    slot.value = null;
    return;
  }

  const list = listEl.value?.getBoundingClientRect();

  if (!list || !within(list, current.x, current.y, 48, 32)) {
    // A row let go off to the side keeps its last place, like on a phone; a
    // pool tile only joins the rotation when it is over the list.
    if (current.from === "pool") {
      slot.value = null;
    }

    return;
  }

  const count = entries.value.length - (current.from === "rotation" ? 1 : 0);

  slot.value = Math.max(
    0,
    Math.min(count, Math.floor((current.y - list.top) / rowHeight)),
  );
}

function autoScroll() {
  const current = drag.value;

  if (!current?.active || current.settleTo) {
    return;
  }

  const scroller = listEl.value && scrollerOf(listEl.value);

  if (scroller) {
    const bounds =
      scroller === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight }
        : scroller.getBoundingClientRect();
    const edge = 72;
    let speed = 0;

    if (current.y < bounds.top + edge) {
      speed = -((bounds.top + edge - current.y) / edge) * 16;
    } else if (current.y > bounds.bottom - edge) {
      speed = ((current.y - (bounds.bottom - edge)) / edge) * 16;
    }

    if (speed) {
      scroller.scrollBy(0, speed);
      track();
    }
  }

  scrollFrame = requestAnimationFrame(autoScroll);
}

function onPointerUp(event: PointerEvent) {
  const current = drag.value;

  if (!current || event.pointerId !== current.pointerId) {
    return;
  }

  if (!current.active) {
    finishDrag();
    return;
  }

  suppressClickUntil = performance.now() + 100;

  if (overPool.value) {
    remove(current.index);
    finishDrag();
    return;
  }

  if (slot.value === null) {
    finishDrag();
    return;
  }

  const target = listEl.value
    ?.querySelector("[data-rotation-placeholder]")
    ?.getBoundingClientRect();

  if (
    !target ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    commitDrag();
    return;
  }

  current.settleTo = { x: target.left, y: target.top };
  setTimeout(commitDrag, 160);
}

function commitDrag() {
  const current = drag.value;
  const at = slot.value;

  if (current?.active && at !== null) {
    if (current.from === "rotation") {
      const next = entries.value.filter((_, index) => index !== current.index);
      next.splice(at, 0, current.map);
      entries.value = next;
    } else {
      insertAt(at, [current.map]);
    }
  }

  finishDrag();
}

function onDragKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    finishDrag();
  }
}

function finishDrag() {
  if (drag.value?.active) {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  cancelAnimationFrame(scrollFrame);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", finishDrag);
  window.removeEventListener("keydown", onDragKey);
  window.removeEventListener("scroll", track, true);
  drag.value = null;
  slot.value = null;
  overPool.value = false;
}

onBeforeUnmount(finishDrag);

function clickTile(map: RotationMap) {
  if (performance.now() < suppressClickUntil) {
    return;
  }

  fromPool(() => add(map));
}

const draggingTile = (map: RotationMap) =>
  drag.value?.active &&
  drag.value.from === "pool" &&
  mapKey(drag.value.map) === mapKey(map);

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

  addAll(imported.maps);

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

      <div class="grid gap-2">
        <div class="flex h-6 items-center justify-between gap-3">
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.dedicated_servers.detail.map_rotation.in_rotation") }}
            ·
            <span class="tabular-nums text-[hsl(var(--tac-amber))]">
              {{ entries.length }}
            </span>
          </span>
          <button
            v-if="entries.length"
            type="button"
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-destructive"
            @click="clear"
          >
            {{ $t("pages.dedicated_servers.detail.map_rotation.clear") }}
          </button>
        </div>

        <div
          ref="listEl"
          data-rotation-list
          :style="drag?.active ? { minHeight: `${listLock}px` } : undefined"
        >
          <TransitionGroup
            v-if="rows.length"
            tag="ol"
            :class="[
              'overflow-hidden rounded-md border transition-[border-color] duration-150',
              drag?.active
                ? 'border-[hsl(var(--tac-amber)/0.45)]'
                : 'border-border',
            ]"
            enter-active-class="rotation-row-enter"
            enter-from-class="rotation-row-from"
            move-class="rotation-row-move"
          >
            <li
              v-for="(row, index) in rows"
              :key="mapKey(row.map)"
              data-rotation-row
              :data-rotation-placeholder="row.placeholder || undefined"
              class="relative border-b border-border/60 last:border-b-0"
              @pointerdown="pressRow(index, $event)"
            >
              <div
                :class="[
                  'group flex items-center gap-3 px-3 py-2',
                  row.placeholder ? 'invisible' : '',
                  drag?.active ? '' : 'sm:cursor-grab',
                ]"
              >
                <GripVertical
                  class="hidden h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground sm:block"
                />
                <div class="flex shrink-0 flex-col sm:hidden">
                  <button
                    type="button"
                    class="flex h-4 w-5 items-center justify-center text-muted-foreground/70 disabled:opacity-25"
                    :disabled="index === 0"
                    :aria-label="
                      $t(
                        'pages.dedicated_servers.detail.map_rotation.move_up',
                      )
                    "
                    @click="moveTo(index, index - 1)"
                  >
                    <ChevronUp class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    class="flex h-4 w-5 items-center justify-center text-muted-foreground/70 disabled:opacity-25"
                    :disabled="index === rows.length - 1"
                    :aria-label="
                      $t(
                        'pages.dedicated_servers.detail.map_rotation.move_down',
                      )
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
                    v-if="hasPoster(row.map)"
                    :src="row.map.poster!"
                    alt=""
                    loading="lazy"
                    draggable="false"
                    class="h-full w-full object-cover"
                    @error="posterFailed(row.map)"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center text-muted-foreground/40"
                  >
                    <MapIcon class="h-4 w-4" />
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ mapLabel(row.map) }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    <template v-if="row.map.workshop_map_id">
                      {{
                        $t(
                          "pages.dedicated_servers.detail.map_rotation.workshop",
                        )
                      }}
                      ·
                      <span class="font-mono">{{
                        row.map.workshop_map_id
                      }}</span>
                    </template>
                    <span v-else class="font-mono">{{ row.map.name }}</span>
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
              <div
                v-if="row.placeholder"
                class="absolute inset-1 rounded-sm border border-dashed border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.06)]"
              ></div>
            </li>
          </TransitionGroup>

          <div
            v-else
            :class="[
              'grid place-items-center gap-1 rounded-md border border-dashed px-6 py-8 text-center transition-colors',
              drag?.active
                ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.05)]'
                : 'border-border/70',
            ]"
          >
            <p class="text-sm font-medium">
              {{
                $t("pages.dedicated_servers.detail.map_rotation.empty_title")
              }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.dedicated_servers.detail.map_rotation.empty") }}
            </p>
          </div>
        </div>
      </div>

      <div
        ref="poolEl"
        data-rotation-pool
        :class="[
          'grid gap-4 rounded-lg border border-dashed bg-card/20 p-3 transition-colors',
          overPool
            ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.05)]'
            : 'border-border/70',
        ]"
      >
        <div class="flex h-8 items-center justify-between gap-3">
          <span
            v-if="drag?.active && drag.from === 'rotation'"
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("pages.dedicated_servers.detail.map_rotation.drop_to_remove") }}
          </span>
          <span
            v-else
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.dedicated_servers.detail.map_rotation.available") }}
            ·
            <span class="tabular-nums">{{ available.length }}</span>
          </span>
          <div v-if="available.length > 6" class="relative w-40 sm:w-48">
            <Search
              class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              v-model="filter"
              class="h-8 pl-7 text-xs"
              :placeholder="
                $t('pages.dedicated_servers.detail.map_rotation.filter')
              "
              :aria-label="
                $t('pages.dedicated_servers.detail.map_rotation.filter')
              "
            />
          </div>
        </div>

        <div v-for="group in pool" :key="group.key" class="grid gap-2">
          <div class="flex items-center justify-between gap-3">
            <span
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ group.label }}
              ·
              <span class="tabular-nums">{{ group.maps.length }}</span>
            </span>
            <button
              type="button"
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
              @click="fromPool(() => addAll(group.maps))"
            >
              {{ $t("pages.dedicated_servers.detail.map_rotation.add_all") }}
            </button>
          </div>
          <div
            class="grid gap-2"
            style="grid-template-columns: repeat(auto-fill, minmax(124px, 1fr))"
          >
            <button
              v-for="map in group.maps"
              :key="mapKey(map)"
              type="button"
              data-rotation-tile
              :title="mapLabel(map)"
              :aria-label="
                $t('pages.dedicated_servers.detail.map_rotation.add_named', {
                  map: mapLabel(map),
                })
              "
              :class="[
                'rotation-tile group relative h-14 cursor-pointer overflow-hidden rounded-md border border-border bg-muted/40 text-left transition-[border-color,opacity] duration-150 hover:border-[hsl(var(--tac-amber)/0.6)] focus-visible:border-[hsl(var(--tac-amber))] focus-visible:outline-none',
                draggingTile(map) ? 'opacity-30' : '',
              ]"
              @pointerdown="pressTile(map, $event)"
              @click="clickTile(map)"
            >
              <img
                v-if="hasPoster(map)"
                :src="map.poster!"
                alt=""
                aria-hidden="true"
                loading="lazy"
                draggable="false"
                class="absolute inset-0 h-full w-full object-cover opacity-60 grayscale transition-[transform,filter,opacity] duration-150 group-hover:scale-[1.04] group-hover:opacity-100 group-hover:grayscale-0 group-focus-visible:opacity-100 group-focus-visible:grayscale-0 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                @error="posterFailed(map)"
              />
              <MapIcon
                v-else
                class="absolute left-1/2 top-2.5 h-4 w-4 -translate-x-1/2 text-muted-foreground/40"
              />
              <span
                class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4"
              >
                <span
                  class="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white"
                >
                  {{ mapLabel(map) }}
                </span>
                <Plus
                  class="h-3 w-3 shrink-0 text-[hsl(var(--tac-amber))] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </span>
            </button>
          </div>
        </div>

        <p
          v-if="!pool.length"
          class="py-4 text-center text-xs text-muted-foreground"
        >
          {{
            available.length
              ? $t("pages.dedicated_servers.detail.map_rotation.no_matches")
              : $t("pages.dedicated_servers.detail.map_rotation.all_added")
          }}
        </p>
      </div>

      <div class="grid gap-2 md:max-w-md">
        <Label for="rotation-workshop">
          {{ $t("pages.dedicated_servers.detail.map_rotation.from_workshop") }}
        </Label>
        <div class="flex gap-2">
          <Input
            id="rotation-workshop"
            v-model="collection"
            class="min-w-0 flex-1"
            :placeholder="
              $t('pages.dedicated_servers.detail.map_rotation.import_placeholder')
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

    <Teleport to="body">
      <div
        v-if="drag?.active"
        :class="[
          'pointer-events-none fixed left-0 top-0 z-[200]',
          drag.settleTo ? 'rotation-ghost-landing' : '',
        ]"
        :style="{
          width: `${drag.width}px`,
          height: `${drag.height}px`,
          transform: ghostTransform,
        }"
      >
        <div
          :class="[
            'rotation-ghost h-full w-full overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.6)] bg-card',
            drag.settleTo ? 'rotation-ghost-settle' : '',
            drag.settleTo && drag.from === 'pool' ? 'opacity-0' : '',
            overPool ? 'opacity-60' : '',
          ]"
        >
          <div
            v-if="drag.from === 'rotation'"
            class="flex h-full items-center gap-3 px-3"
          >
            <GripVertical class="h-4 w-4 shrink-0 text-muted-foreground" />
            <span
              class="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-[hsl(var(--tac-amber))]"
            >
              {{ slot === null ? "–" : slot + 1 }}
            </span>
            <div
              class="h-9 w-16 shrink-0 overflow-hidden rounded-sm bg-muted/40"
            >
              <img
                v-if="hasPoster(drag.map)"
                :src="drag.map.poster!"
                alt=""
                class="h-full w-full object-cover"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ mapLabel(drag.map) }}
              </p>
              <p class="truncate font-mono text-xs text-muted-foreground">
                {{ drag.map.workshop_map_id || drag.map.name }}
              </p>
            </div>
          </div>
          <div v-else class="relative h-full w-full">
            <img
              v-if="hasPoster(drag.map)"
              :src="drag.map.poster!"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
            />
            <span
              class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4"
            >
              <span
                class="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white"
              >
                {{ mapLabel(drag.map) }}
              </span>
              <Plus class="h-3 w-3 shrink-0 text-[hsl(var(--tac-amber))]" />
            </span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.rotation-row-enter {
  transition:
    opacity 0.14s ease,
    transform 0.14s cubic-bezier(0.16, 1, 0.3, 1);
}
.rotation-row-from {
  opacity: 0;
  transform: translateY(-4px);
}
.rotation-row-move {
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.rotation-tile {
  animation: rotation-tile-in 0.14s ease-out;
}
@keyframes rotation-tile-in {
  from {
    opacity: 0;
  }
}
.rotation-ghost {
  transform: scale(1.03);
  box-shadow: 0 22px 44px -18px rgb(0 0 0 / 0.85);
  transition:
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.16s ease,
    opacity 0.16s ease;
  animation: rotation-lift 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes rotation-lift {
  from {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgb(0 0 0 / 0);
  }
}
.rotation-ghost-landing {
  transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}
.rotation-ghost-settle {
  transform: scale(1);
  box-shadow: 0 0 0 0 rgb(0 0 0 / 0);
}
@media (prefers-reduced-motion: reduce) {
  .rotation-row-enter,
  .rotation-row-move,
  .rotation-ghost,
  .rotation-ghost-landing {
    transition-duration: 1ms;
  }
  .rotation-tile,
  .rotation-ghost {
    animation: none;
  }
}
</style>
