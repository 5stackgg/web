<script setup lang="ts">
/**
 * The Collections tab.
 *
 * A collection used to be a row you could not open: you could put a lineup in
 * one from three places and then never look inside it. Here it opens into the
 * card, lists its lineups the way the library does, draws them on the board
 * as a set, and carries a header for filling it and managing it. Practising
 * it is offered in the bar at the foot of the card.
 *
 * A collection spans maps and the page is one map, so every row is read
 * against the map you are on: how many are here, of which utility, and where
 * the rest are.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Lock, Plus, Search, X } from "lucide-vue-next";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/toast";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import UtilityCollectionAddView from "~/components/utility/UtilityCollectionAddView.vue";
import UtilityCollectionView from "~/components/utility/UtilityCollectionView.vue";
import UtilityRow from "~/components/utility/UtilityRow.vue";
import UtilitySectionHead from "~/components/utility/UtilitySectionHead.vue";
import UtilitySetThumb from "~/components/utility/UtilitySetThumb.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import {
  addLineupToCollectionMutation,
  addLineupsToCollectionMutation,
  createUtilityCollectionMutation,
  deleteUtilityCollectionMutation,
  removeLineupFromCollectionMutation,
  updateUtilityCollectionMutation,
  utilityCollectionsBrowseQuery,
  utilityLineupsQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import cleanMapName from "~/utilities/cleanMapName";
import { UTILITY_TYPES, UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type {
  UtilityBarOffer,
  UtilityLineupContext,
  UtilityPanelBoard,
  UtilityPracticeTarget,
} from "~/utilities/utilityDisplay";
import type {
  UtilityCollection,
  UtilityCollectionCard,
  UtilityCollectionItem,
  UtilityCollectionLineupRef,
  UtilityLineup,
  UtilityType,
  UtilityVisibility,
} from "~/types/utility";

const props = defineProps<{
  mapName: string;
  /** The page's one type filter. */
  types: UtilityType[];
  /** The lineup the page has open over the card. */
  openLineupId: string | null;
  /** Off on a phone, which cannot join the server Practice ends in. */
  canPractice: boolean;
}>();

const emit = defineEmits<{
  (e: "board", state: UtilityPanelBoard | null): void;
  // A view of this panel is open over the list, so the page steps its list
  // back the way it does for a lineup.
  (e: "cover", value: boolean): void;
  // What the bar at the foot of the card should offer while a collection is
  // open: practising it, once there is a server to practise on.
  (e: "bar", offer: UtilityBarOffer | null): void;
  (e: "toggle-type", type: UtilityType): void;
  (e: "open-lineup", id: string, context?: UtilityLineupContext): void;
  (e: "practice", target: UtilityPracticeTarget): void;
}>();

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

const auth = useAuthStore();
const mySteamId = computed(() => auth.me?.steam_id ?? null);
const myTeams = computed(
  () => (auth.me?.teams ?? []) as Array<{ id: string; name: string }>,
);

const map = computed(() => cleanMapName(props.mapName));

const collections = ref<UtilityCollection[]>([]);
// True from the start: the panel mounts and fetches in the same breath, and a
// tab that renders nothing at all for its first frames is pop-in.
const loading = ref(true);

const { skeleton, refreshing } = useDeferredLoading(() => loading.value);

// A collection's own order first; anything saved before positions were
// written falls back to when it was added.
const ITEMS_ORDER = [{ position: order_by.asc }, { created_at: order_by.asc }];

async function fetchCollections(
  where: Record<string, unknown>,
  limit: number,
): Promise<UtilityCollection[]> {
  const { data } = await getGraphqlClient().query({
    query: utilityCollectionsBrowseQuery,
    variables: {
      where,
      order_by: [{ created_at: order_by.desc }],
      limit,
      items_order_by: ITEMS_ORDER,
    },
    fetchPolicy: "network-only",
  });
  return ((data as any)?.utility_collections ?? []) as UtilityCollection[];
}

/**
 * A collection is an address -- `?collection=<id>` -- for the same reason a
 * lineup is: a link opens straight onto it, and the browser's Back closes it.
 */
const openId = computed<string | null>(() =>
  typeof route.query.collection === "string" && route.query.collection
    ? route.query.collection
    : null,
);

function setOpen(id: string | null, mode: "push" | "replace") {
  const query = { ...route.query } as Record<string, unknown>;
  if (id) {
    query.collection = id;
  } else {
    delete query.collection;
  }
  const to = { path: route.path, query: query as any, hash: route.hash };
  return mode === "push" ? router.push(to) : router.replace(to);
}

function openCollection(id: string) {
  void setOpen(id, openId.value ? "replace" : "push");
}

// The address belongs to this tab. Left behind, it would reopen the
// collection the next time the tab did, long after you had moved on.
const homeRoute = route.name;
onBeforeUnmount(() => {
  if (openId.value && route.name === homeRoute) {
    void setOpen(null, "replace");
  }
});

// A link to a collection the lists below did not reach -- somebody else's
// public one, past the first fifty.
const resolving = ref(false);

async function ensureOpen() {
  const id = openId.value;
  if (!id || collections.value.some((entry) => entry.id === id)) {
    return;
  }
  resolving.value = true;
  try {
    const rows = await fetchCollections({ id: { _eq: id } }, 1);
    if (
      rows.length &&
      !collections.value.some((entry) => entry.id === rows[0].id)
    ) {
      collections.value = [...collections.value, ...rows];
    }
  } catch (error) {
    console.error("[utility] collection load error:", error);
  } finally {
    resolving.value = false;
  }
}

let loadGen = 0;

async function refresh({ quiet = false }: { quiet?: boolean } = {}) {
  const gen = ++loadGen;
  const me = mySteamId.value;
  if (!me) {
    collections.value = [];
    loading.value = false;
    return;
  }

  if (!quiet) {
    loading.value = true;
  }
  try {
    // Two reads rather than one: every public collection is visible to
    // everyone, and a single newest-first page of those would push your own
    // off the end the day the library gets busy.
    const [own, shared] = await Promise.all([
      fetchCollections(
        {
          _or: [
            { owner_steam_id: { _eq: me } },
            { visibility: { _eq: "Team" } },
          ],
        },
        100,
      ),
      fetchCollections(
        { owner_steam_id: { _neq: me }, visibility: { _eq: "Public" } },
        50,
      ),
    ]);
    if (gen !== loadGen) {
      return;
    }
    const seen = new Set<string>();
    collections.value = [...own, ...shared].filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
    await ensureOpen();
  } catch (error) {
    if (gen === loadGen) {
      console.error("[utility] collections load error:", error);
      if (!quiet) {
        collections.value = [];
      }
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(mySteamId, () => void refresh(), { immediate: true });

watch(openId, () => {
  if (!loading.value) {
    void ensureOpen();
  }
});

function toCard(collection: UtilityCollection): UtilityCollectionCard {
  // A lineup the caller cannot see comes back null through the relationship,
  // and an archived one is out of every library view: neither is counted.
  const refs: UtilityCollectionLineupRef[] = [];
  for (const item of collection.items ?? []) {
    if (item.utility_lineup && !item.utility_lineup.archived_at) {
      refs.push(item.utility_lineup);
    }
  }
  const here = refs.filter((lineup) => lineup.map_name === props.mapName);
  const counts: Partial<Record<UtilityType, number>> = {};
  for (const lineup of here) {
    counts[lineup.utility_type] = (counts[lineup.utility_type] ?? 0) + 1;
  }
  return {
    collection,
    mine:
      !!mySteamId.value &&
      `${collection.owner_steam_id}` === `${mySteamId.value}`,
    here,
    total: refs.length,
    counts,
    otherMaps: [
      ...new Set(
        refs
          .filter((lineup) => lineup.map_name !== props.mapName)
          .map((lineup) => lineup.map_name),
      ),
    ],
  };
}

const cards = computed(() => collections.value.map(toCard));

function listMaps(names: string[]) {
  const labels = names.map((name) => cleanMapName(name));
  try {
    return new Intl.ListFormat(locale.value.replace("_", "-"), {
      style: "long",
      type: "conjunction",
    }).format(labels);
  } catch {
    return labels.join(", ");
  }
}

function tallies(card: UtilityCollectionCard) {
  return UTILITY_TYPES.filter((type) => card.counts[type]).map((type) => ({
    type,
    count: card.counts[type] ?? 0,
    color: UTILITY_TYPE_COLORS[type],
  }));
}

const searchId = useId();
const search = ref("");

const shown = computed(() => {
  const query = search.value.trim().toLowerCase();
  return query
    ? cards.value.filter((card) =>
        card.collection.name.toLowerCase().includes(query),
      )
    : cards.value;
});

// What has something on this map, then what does not: a collection built for
// Inferno is still yours while you stand on Mirage, it is just not the answer.
const sections = computed(() =>
  [
    {
      key: "here",
      label: t("pages.utility.collections.on_map", { map: map.value }),
      cards: shown.value.filter((card) => card.here.length > 0),
    },
    {
      key: "away",
      label: t("pages.utility.collections.none_on_map", { map: map.value }),
      cards: shown.value.filter((card) => card.here.length === 0),
    },
  ].filter((section) => section.cards.length > 0),
);

const current = computed(() =>
  openId.value
    ? (cards.value.find((card) => card.collection.id === openId.value) ?? null)
    : null,
);

watch(
  () => !!openId.value,
  (open) => emit("cover", open),
  { immediate: true },
);

/**
 * The open collection's lineups as the full rows a lineup card draws. The
 * list read above carries them light; the rest is fetched once per lineup and
 * kept, so stepping between collections that share lineups asks for nothing.
 */
const lineupsById = ref<Record<string, UtilityLineup>>({});
const lineupsLoading = ref(false);
let lineupGen = 0;

async function loadLineups(ids: string[]) {
  const missing = ids.filter((id) => !lineupsById.value[id]);
  if (!missing.length) {
    return;
  }
  const gen = ++lineupGen;
  lineupsLoading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery(),
      variables: {
        where: { id: { _in: missing }, can_view: { _eq: true } },
        order_by: [{ created_at: order_by.desc }],
        limit: missing.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    const next = { ...lineupsById.value };
    for (const lineup of ((data as any)?.utility_lineups ??
      []) as UtilityLineup[]) {
      next[lineup.id] = lineup;
    }
    lineupsById.value = next;
  } catch (error) {
    console.error("[utility] collection lineups load error:", error);
  } finally {
    if (gen === lineupGen) {
      lineupsLoading.value = false;
    }
  }
}

const hereIds = computed(
  () => current.value?.here.map((lineup) => lineup.id) ?? [],
);

watch(
  () => hereIds.value.join(","),
  () => void loadLineups(hereIds.value),
  { immediate: true },
);

const openLineups = computed(() =>
  hereIds.value
    .map((id) => lineupsById.value[id])
    .filter((lineup): lineup is UtilityLineup => !!lineup),
);

const pickOpen = ref(false);
const hoveredCollectionId = ref<string | null>(null);
const hoveredLineupId = ref<string | null>(null);
const pickHover = ref<UtilityLineup | null>(null);

// Leaving one row for the next fires the leave after the enter on a fast
// pointer, so a leave only clears the hover that is its own.
function hoverCollection(id: string, over: boolean) {
  if (over) {
    hoveredCollectionId.value = id;
  } else if (hoveredCollectionId.value === id) {
    hoveredCollectionId.value = null;
  }
}

function hoverLineup(id: string | null) {
  hoveredLineupId.value = id;
}

function hoverPick(lineup: UtilityLineup | null) {
  pickHover.value = lineup;
}

function toggleType(type: UtilityType) {
  emit("toggle-type", type);
}

watch(openId, () => {
  pickOpen.value = false;
  pickHover.value = null;
  hoveredLineupId.value = null;
});

function typed<T extends { utility_type: UtilityType }>(lineups: T[]): T[] {
  return props.types.length
    ? lineups.filter((lineup) => props.types.includes(lineup.utility_type))
    : lineups;
}

// The lineup's panel says where it was opened from, with the collection's
// name marked for emphasis.
function openLineup(id: string) {
  const card = current.value;
  emit(
    "open-lineup",
    id,
    card
      ? {
          text: t("pages.utility.collections.lineup_context", {
            name: card.collection.name,
          }),
        }
      : undefined,
  );
}

/**
 * What the board draws. The page's map is the only map, so each state of the
 * panel says what it wants on it.
 *
 * Deliberately no hand-back on unmount: the panel leaves through a crossfade,
 * so its unmount lands after the next tab has published its own board.
 */
const board = computed<UtilityPanelBoard>(() => {
  const card = current.value;

  // Filling it: the set so far, lines on, plus whichever row is being pointed
  // at -- so you see what a lineup would add before you tick it.
  if (card && pickOpen.value) {
    const set = typed(openLineups.value);
    const pointed = pickHover.value;
    return {
      lineups:
        pointed && !set.some((lineup) => lineup.id === pointed.id)
          ? [...set, pointed]
          : set,
      showAllLines: true,
      hoveredId: pointed?.id ?? null,
      onSelect: () => {},
    };
  }

  // Open: only this collection, every line drawn, so it reads as a set.
  if (card) {
    return {
      lineups: typed(openLineups.value),
      showAllLines: true,
      selectedId: props.openLineupId,
      hoveredId: hoveredLineupId.value,
      onSelect: (id) => {
        if (id) {
          openLineup(id);
        }
      },
      onHover: (id) => {
        hoveredLineupId.value = id;
      },
    };
  }

  // The list: the set under the cursor, or everything collected on this map.
  const pointed = hoveredCollectionId.value
    ? cards.value.find(
        (entry) => entry.collection.id === hoveredCollectionId.value,
      )
    : null;
  if (pointed) {
    return { lineups: pointed.here as UtilityLineup[], showAllLines: true };
  }
  const seen = new Set<string>();
  const all: UtilityCollectionLineupRef[] = [];
  for (const entry of cards.value) {
    for (const lineup of entry.here) {
      if (!seen.has(lineup.id)) {
        seen.add(lineup.id);
        all.push(lineup);
      }
    }
  }
  return { lineups: all as UtilityLineup[] };
});

watch(board, (state) => emit("board", state), { immediate: true });

const creating = ref(false);
const newName = ref("");
const saving = ref(false);
const nameId = useId();
const nameInput = ref<{ $el?: HTMLElement } | null>(null);

// With nothing to list, the field is the tab: there is no list to put a New
// button beside.
const naming = computed(
  () => creating.value || (!loading.value && collections.value.length === 0),
);

async function startCreate() {
  creating.value = true;
  await nextTick();
  // shadcn-vue's Input forwards its attrs to a real <input>, but the ref holds
  // the component, so the field itself has to be dug out of its root.
  const root = nameInput.value?.$el as HTMLElement | undefined;
  const field =
    root instanceof HTMLInputElement ? root : root?.querySelector("input");
  field?.focus();
}

function cancelCreate() {
  creating.value = false;
  newName.value = "";
}

// Naming one makes it and opens it: the next thing anyone does with a new
// collection is put something in it, and that is in its dock.
async function create() {
  const name = newName.value.trim();
  if (!name || saving.value) {
    return;
  }
  saving.value = true;
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: createUtilityCollectionMutation,
      // No map_name: a collection is not stamped with the map you happened to
      // be standing on when you named it.
      variables: { object: { name } },
    });
    const id = (data as any)?.insert_utility_collections_one?.id;
    if (!id) {
      throw new Error("no collection");
    }
    cancelCreate();
    await refresh({ quiet: true });
    openCollection(id);
  } catch (error: any) {
    console.error("[utility] collection create error:", error);
    toast({
      title: t("pages.utility.collections.create_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    saving.value = false;
  }
}

// Patched in place rather than refetched: the row you changed is the one
// thing you are looking at.
function patchCollection(id: string, patch: Partial<UtilityCollection>) {
  collections.value = collections.value.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  );
}

function failed(error: any) {
  console.error("[utility] collection update error:", error);
  toast({
    title: t("pages.utility.collections.update_failed"),
    description: error?.message,
    variant: "destructive",
  });
}

async function rename(name: string) {
  const collection = current.value?.collection;
  if (!collection) {
    return;
  }
  const before = collection.name;
  patchCollection(collection.id, { name });
  try {
    await getGraphqlClient().mutate({
      mutation: updateUtilityCollectionMutation,
      variables: { id: collection.id, set: { name } },
    });
  } catch (error) {
    patchCollection(collection.id, { name: before });
    failed(error);
  }
}

async function setVisibility(
  visibility: UtilityVisibility,
  teamId: string | null,
) {
  const collection = current.value?.collection;
  if (!collection) {
    return;
  }
  const before = {
    visibility: collection.visibility,
    team_id: collection.team_id,
  };
  // The team only rides along while it is the thing being addressed.
  const next = { visibility, team_id: visibility === "Team" ? teamId : null };
  patchCollection(collection.id, next);
  try {
    await getGraphqlClient().mutate({
      mutation: updateUtilityCollectionMutation,
      variables: { id: collection.id, set: next },
    });
  } catch (error) {
    patchCollection(collection.id, before);
    failed(error);
  }
}

const copying = ref(false);

// Your own collection duplicated, or somebody else's saved as yours: either
// way a private collection of your own with the same lineups in it.
async function duplicate() {
  const card = current.value;
  if (!card || copying.value) {
    return;
  }
  copying.value = true;
  try {
    const client = getGraphqlClient();
    const { data } = await client.mutate({
      mutation: createUtilityCollectionMutation,
      variables: {
        object: {
          name: t("pages.utility.collections.copy_name", {
            name: card.collection.name,
          }).slice(0, 120),
          description: card.collection.description ?? null,
        },
      },
    });
    const id = (data as any)?.insert_utility_collections_one?.id;
    if (!id) {
      throw new Error("no collection");
    }
    const ids = (card.collection.items ?? [])
      .filter((item) => item.utility_lineup && !item.utility_lineup.archived_at)
      .map((item) => item.utility_lineup_id);
    if (ids.length) {
      await client.mutate({
        mutation: addLineupsToCollectionMutation,
        variables: {
          objects: ids.map((utility_lineup_id, position) => ({
            collection_id: id,
            utility_lineup_id,
            position,
          })),
        },
      });
    }
    await refresh({ quiet: true });
    await setOpen(id, "replace");
    toast({ title: t("pages.utility.collections.copied") });
  } catch (error: any) {
    console.error("[utility] collection copy error:", error);
    toast({
      title: t("pages.utility.collections.copy_failed"),
      description: error?.message,
      variant: "destructive",
    });
    // The collection may exist without all of its lineups.
    void refresh({ quiet: true });
  } finally {
    copying.value = false;
  }
}

async function remove() {
  const collection = current.value?.collection;
  if (!collection) {
    return;
  }
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: deleteUtilityCollectionMutation,
      variables: { id: collection.id },
    });
    // Only the owner may delete, and a delete that matched no row succeeds
    // with nothing in it.
    if (!(data as any)?.delete_utility_collections_by_pk?.id) {
      throw new Error(t("pages.utility.collections.delete_failed"));
    }
    // Closed before it is dropped, so the view never has an id with nothing
    // behind it to call "not found".
    await setOpen(null, "replace");
    collections.value = collections.value.filter(
      (entry) => entry.id !== collection.id,
    );
    toast({
      title: t("pages.utility.collections.deleted", { name: collection.name }),
    });
  } catch (error: any) {
    console.error("[utility] collection delete error:", error);
    toast({
      title: t("pages.utility.collections.delete_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

// One write per lineup at a time: a second click on a row still in flight
// would race its own first.
const pendingItems = new Set<string>();

function itemsOf(id: string): UtilityCollectionItem[] {
  return collections.value.find((entry) => entry.id === id)?.items ?? [];
}

// A tick lands on the row before the server answers and is taken back if the
// server says no.
async function toggleItem(lineup: UtilityLineup) {
  const collection = current.value?.collection;
  if (!collection || pendingItems.has(lineup.id)) {
    return;
  }
  const id = collection.id;
  const before = itemsOf(id);
  const item = before.find((entry) => entry.utility_lineup_id === lineup.id);
  pendingItems.add(lineup.id);
  lineupsById.value = { ...lineupsById.value, [lineup.id]: lineup };
  patchCollection(id, {
    items: item
      ? before.filter((entry) => entry !== item)
      : [...before, { utility_lineup_id: lineup.id, utility_lineup: lineup }],
  });
  try {
    if (item) {
      await getGraphqlClient().mutate({
        mutation: removeLineupFromCollectionMutation,
        variables: {
          where: {
            collection_id: { _eq: id },
            utility_lineup_id: { _eq: lineup.id },
          },
        },
      });
    } else {
      await getGraphqlClient().mutate({
        mutation: addLineupToCollectionMutation,
        variables: {
          object: {
            collection_id: id,
            utility_lineup_id: lineup.id,
            position: before.length,
          },
        },
      });
    }
  } catch (error) {
    // Only this lineup goes back: other rows may have been ticked since.
    const now = itemsOf(id);
    patchCollection(id, {
      items: item
        ? [...now, item]
        : now.filter((entry) => entry.utility_lineup_id !== lineup.id),
    });
    failed(error);
  } finally {
    pendingItems.delete(lineup.id);
  }
}

const load = useUtilityLoad();
void load.check();

const practicing = computed(() => load.sending.value === "drill");

// On a practice server for this map the set goes straight to it. On one for
// another map the host brings the server here with the set queued. With no
// server there is nothing to send to yet, so the page opens the one place a
// server is started.
async function practice() {
  const card = current.value;
  const lineups = openLineups.value;
  if (!card || !lineups.length) {
    return;
  }
  if (load.canLoad(props.mapName)) {
    await load.sendDrill(lineups);
    return;
  }
  if (load.canSwitchTo(props.mapName)) {
    await load.switchMap(props.mapName, {
      key: "drill",
      name: card.collection.name,
      lineup_ids: lineups.map((lineup) => lineup.id),
    });
    return;
  }
  emit("practice", { collectionId: card.collection.id });
}

const barOffer = computed<UtilityBarOffer | null>(() => {
  const card = current.value;
  if (!card || !props.canPractice || pickOpen.value) {
    return null;
  }
  const reachable =
    load.canLoad(props.mapName) || load.canSwitchTo(props.mapName);
  return {
    target: { collectionId: card.collection.id },
    actions:
      reachable && openLineups.value.length
        ? [
            {
              kind: "run",
              key: "drill",
              label: t("pages.utility.practice.start"),
              run: practice,
              loading: practicing.value,
            },
          ]
        : [],
  };
});

watch(barOffer, (offer) => emit("bar", offer), { immediate: true });

async function copyLink() {
  const collection = current.value?.collection;
  if (!collection) {
    return;
  }
  const { href } = router.resolve({
    path: route.path,
    query: { tab: "collections", collection: collection.id },
  });
  const url = new URL(href, window.location.origin).toString();
  try {
    await navigator.clipboard.writeText(url);
    toast({ title: t("toasts.link_copied") });
  } catch {
    // Refused by the browser: hand over the address to copy by hand.
    toast({ title: t("toasts.copy_failed"), description: url });
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Naming a collection is something you do to the list, so the field
         takes the search row's place instead of opening under it. -->
    <form
      v-if="naming"
      class="flex items-center gap-1.5"
      @submit.prevent="create()"
    >
      <label class="sr-only" :for="nameId">
        {{ $t("pages.utility.collections.name_placeholder") }}
      </label>
      <Input
        :id="nameId"
        ref="nameInput"
        v-model="newName"
        maxlength="120"
        spellcheck="false"
        class="h-8 min-w-0 flex-1 text-base focus-visible:ring-inset md:text-sm"
        :placeholder="$t('pages.utility.collections.name_placeholder')"
        @keydown.esc.stop.prevent="cancelCreate()"
      />
      <Button
        type="submit"
        size="sm"
        class="tac-amber-cta h-8 shrink-0 px-3"
        :loading="saving"
        :disabled="!newName.trim()"
      >
        {{ $t("common.create") }}
      </Button>
      <Button
        v-if="collections.length"
        type="button"
        size="icon"
        variant="ghost"
        class="h-8 w-8 shrink-0"
        :aria-label="$t('common.cancel')"
        @click="cancelCreate()"
      >
        <X class="h-4 w-4" />
      </Button>
    </form>

    <div v-else class="flex items-center gap-2">
      <div class="relative min-w-0 flex-1">
        <Search
          class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <label class="sr-only" :for="searchId">
          {{ $t("pages.utility.collections.search_placeholder") }}
        </label>
        <Input
          :id="searchId"
          v-model="search"
          spellcheck="false"
          class="h-8 pl-7 text-base focus-visible:ring-inset md:text-xs"
          :placeholder="$t('pages.utility.collections.search_placeholder')"
        />
      </div>
      <button
        type="button"
        class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 font-mono text-[0.64rem] font-semibold uppercase leading-none tracking-[0.1em] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        @click="startCreate()"
      >
        <Plus class="h-3.5 w-3.5" />
        {{ $t("pages.utility.collections.new_short") }}
      </button>
    </div>

    <HeightSwap>
      <UtilitySkeletonList
        v-if="skeleton"
        key="loading"
        :count="3"
        shape="row"
      />

      <p
        v-else-if="!cards.length"
        key="empty"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{ $t("pages.utility.collections.empty_line") }}
      </p>

      <p
        v-else-if="!shown.length"
        key="no-match"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{ $t("pages.utility.collections.no_match") }}
      </p>

      <div
        v-else
        key="list"
        class="flex flex-col transition-opacity [transition-duration:180ms]"
        :class="refreshing ? 'pointer-events-none opacity-50' : ''"
      >
        <template v-for="section of sections" :key="section.key">
          <UtilitySectionHead
            :label="section.label"
            :count="section.cards.length"
          />
          <div class="flex flex-col gap-2 pb-2">
            <UtilityRow
              v-for="card of section.cards"
              :key="card.collection.id"
              :muted="!card.here.length"
              :hovered="hoveredCollectionId === card.collection.id"
              @select="openCollection(card.collection.id)"
              @hover="(over: boolean) => hoverCollection(card.collection.id, over)"
            >
              <template #thumb>
                <UtilitySetThumb
                  :map-name="mapName"
                  :lineups="card.here as UtilityLineup[]"
                  :size="40"
                />
              </template>

              {{ card.collection.name }}

              <template v-if="!card.collection.can_edit" #badges>
                <FiveStackToolTip as-child :delay-duration="120">
                  <template #trigger>
                    <span class="inline-flex shrink-0 text-muted-foreground">
                      <Lock class="h-3 w-3" />
                      <span class="sr-only">
                        {{ $t("pages.utility.collections.view_only") }}
                      </span>
                    </span>
                  </template>
                  {{ $t("pages.utility.collections.view_only") }}
                </FiveStackToolTip>
              </template>

              <template #line2>
                <span
                  v-if="card.here.length"
                  class="inline-flex shrink-0 items-center gap-[7px]"
                >
                  <span
                    v-for="tally of tallies(card)"
                    :key="tally.type"
                    class="inline-flex items-center gap-[3px] font-semibold"
                  >
                    <span
                      aria-hidden="true"
                      class="size-[7px] rounded-[2px]"
                      :style="{ backgroundColor: tally.color }"
                    />
                    {{ tally.count }}
                    <span class="sr-only">
                      {{ $t(`pages.utility.types.${tally.type}`) }}
                    </span>
                  </span>
                </span>
                <span class="min-w-0 truncate">
                  <template v-if="card.mine">
                    {{
                      $t(
                        `pages.utility.visibility.${card.collection.visibility ?? "Private"}`,
                      )
                    }}
                  </template>
                  <template v-else-if="card.collection.owner?.name">
                    {{
                      $t("pages.utility.collections.by_owner", {
                        name: card.collection.owner.name,
                      })
                    }}
                  </template>
                  <template v-if="!card.here.length && card.otherMaps.length">
                    <span aria-hidden="true" class="mx-1.5 text-border">/</span>
                    {{
                      $t("pages.utility.collections.all_on", {
                        maps: listMaps(card.otherMaps),
                      })
                    }}
                  </template>
                </span>
              </template>

              <!-- How many are on this map, large; under it either what that
                   is out of, or simply what is being counted. -->
              <template #right>
                <span class="flex min-w-9 shrink-0 flex-col items-end">
                  <span class="text-lg font-bold leading-none tabular-nums">
                    {{ card.here.length }}
                  </span>
                  <span
                    class="mt-1 whitespace-nowrap font-mono text-[0.53rem] font-medium uppercase leading-none tracking-[0.1em] tabular-nums text-muted-foreground/70"
                  >
                    <template v-if="card.total > card.here.length">
                      {{
                        $t("pages.utility.collections.of_total", {
                          count: card.total,
                        })
                      }}
                    </template>
                    <template v-else>
                      {{
                        $t(
                          "pages.utility.collections.lineups_unit",
                          { count: card.here.length },
                          card.here.length,
                        )
                      }}
                    </template>
                  </span>
                </span>
              </template>
            </UtilityRow>
          </div>
        </template>
      </div>
    </HeightSwap>

    <UtilityCollectionView
      :open="!!openId"
      :card="current"
      :loading="loading || resolving"
      :lineups="openLineups"
      :lineups-loading="lineupsLoading"
      :map-name="mapName"
      :elsewhere="current ? listMaps(current.otherMaps) : ''"
      :types="types"
      :open-lineup-id="openLineupId"
      :hovered-id="hoveredLineupId"
      :can-practice="canPractice"
      :teams="myTeams"
      :copying="copying"
      @back="setOpen(null, 'replace')"
      @toggle-type="toggleType"
      @open-lineup="openLineup"
      @hover="hoverLineup"
      @add="pickOpen = true"
      @copy-link="copyLink()"
      @rename="rename"
      @visibility="setVisibility"
      @duplicate="duplicate()"
      @delete="remove()"
    />

    <UtilityCollectionAddView
      :open="pickOpen && !!current"
      :map-name="mapName"
      :name="current?.collection.name ?? ''"
      :members="openLineups"
      :types="types"
      @back="pickOpen = false"
      @toggle="toggleItem"
      @toggle-type="toggleType"
      @hover="hoverPick"
    />
  </div>
</template>
