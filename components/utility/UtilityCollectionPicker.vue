<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Check, FolderPlus, Library, Plus, X } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  addLineupToCollectionMutation,
  createUtilityCollectionMutation,
  utilityCollectionItemsQuery,
  utilityCollectionsQuery,
  removeLineupFromCollectionMutation,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityCollection } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    lineupId?: string | null;
    // Dock mode. Set, the trigger is an icon-only tile wearing these classes
    // and the list is a sheet that rises out of the dock it sits in, the full
    // width of the panel, instead of a popover floating over it. The active
    // classes are worn while the lineup is in at least one collection.
    triggerClass?: string | string[] | null;
    // Which way the sheet leaves the bar its tile sits in. The lineup's
    // actions are at the top of the card, so there it drops below.
    placement?: "above" | "below";
    triggerActiveClass?: string | string[] | null;
  }>(),
  {
    lineupId: null,
    triggerClass: null,
    placement: "above",
    triggerActiveClass: null,
  },
);

const triggerRef = ref<HTMLElement | null>(null);
const sheetRef = ref<HTMLElement | null>(null);

/**
 * Chooser mode, used when there is no lineup to write to yet: the picker only
 * reports which collection was picked and touches nothing. Membership mode is
 * the original behaviour and stays the default.
 */
const chosen = defineModel<string | null>("chosen", { default: null });

const chooserMode = computed(() => !props.lineupId);

const { t } = useI18n();

const open = ref(false);
const loading = ref(false);
const collections = ref<UtilityCollection[]>([]);
const memberOf = ref<Set<string>>(new Set());
const newName = ref("");

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

const chosenName = computed(() => {
  if (!chooserMode.value || !chosen.value) {
    return null;
  }
  return (
    collections.value.find((entry) => entry.id === chosen.value)?.name ?? null
  );
});

async function load() {
  if (!mySteamId.value) {
    return;
  }
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const lineupId = props.lineupId;
    const [collectionsResult, membershipResult] = await Promise.all([
      client.query({
        query: utilityCollectionsQuery,
        variables: {
          // can_edit, not an owner column: "collections I can add to" is
          // exactly what the picker is listing, and it is a confirmed field.
          where: { can_edit: { _eq: true } },
          order_by: [{ created_at: order_by.desc }],
          limit: 100,
        },
        fetchPolicy: "network-only",
      }),
      lineupId
        ? client.query({
            query: utilityCollectionItemsQuery,
            variables: {
              where: { utility_lineup_id: { _eq: lineupId } },
            },
            fetchPolicy: "network-only",
          })
        : Promise.resolve({ data: null }),
    ]);
    collections.value = (collectionsResult.data as any)?.utility_collections ?? [];
    memberOf.value = new Set(
      ((membershipResult.data as any)?.utility_collection_items ?? []).map(
        (row: { collection_id: string }) => row.collection_id,
      ),
    );
  } catch (error: any) {
    toast({
      title: t("pages.utility.collections.load_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    loading.value = false;
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    void load();
  }
});

// The tile says whether this lineup is saved anywhere before you open it.
watch(
  () => [props.triggerClass ? props.lineupId : null, mySteamId.value] as const,
  ([id, me]) => {
    if (id && me) {
      void load();
    }
  },
  { immediate: true },
);

// The sheet is part of the panel, not a floating layer, so it does its own
// dismissing: a press anywhere else, or Escape, and focus goes back to the
// tile it came from.
function close() {
  if (!open.value) {
    return;
  }
  open.value = false;
  triggerRef.value?.focus();
}

function onOutside(event: Event) {
  const target = event.target as Node | null;
  if (
    target &&
    !sheetRef.value?.contains(target) &&
    !triggerRef.value?.contains(target)
  ) {
    open.value = false;
  }
}

function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
}

watch(open, (isOpen) => {
  if (!props.triggerClass) {
    return;
  }
  if (isOpen) {
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onEscape, true);
    void nextTick(() => sheetRef.value?.focus());
  } else {
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("keydown", onEscape, true);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onOutside, true);
  document.removeEventListener("keydown", onEscape, true);
});

async function toggle(collection: UtilityCollection) {
  if (chooserMode.value) {
    chosen.value = chosen.value === collection.id ? null : collection.id;
    open.value = false;
    return;
  }
  const client = getGraphqlClient();
  const lineupId = props.lineupId as string;
  const isMember = memberOf.value.has(collection.id);
  try {
    if (isMember) {
      await client.mutate({
        mutation: removeLineupFromCollectionMutation,
        variables: {
          where: {
            collection_id: { _eq: collection.id },
            utility_lineup_id: { _eq: lineupId },
          },
        },
      });
      memberOf.value.delete(collection.id);
    } else {
      await client.mutate({
        mutation: addLineupToCollectionMutation,
        variables: {
          object: {
            collection_id: collection.id,
            utility_lineup_id: lineupId,
          },
        },
      });
      memberOf.value.add(collection.id);
    }
    // A Set mutated in place is not a new reference, so the template needs a
    // fresh one to re-render the ticks.
    memberOf.value = new Set(memberOf.value);
  } catch (error: any) {
    toast({
      title: t("pages.utility.collections.update_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function create() {
  const name = newName.value.trim();
  if (!name) {
    return;
  }
  try {
    const client = getGraphqlClient();
    const { data } = await client.mutate({
      mutation: createUtilityCollectionMutation,
      variables: {
        object: { name },
      },
    });
    const id = (data as any)?.insert_utility_collections_one?.id;
    if (!id) {
      throw new Error("no collection");
    }
    const lineupId = props.lineupId;
    if (lineupId) {
      await client.mutate({
        mutation: addLineupToCollectionMutation,
        variables: {
          object: {
            collection_id: id,
            utility_lineup_id: lineupId,
          },
        },
      });
    } else {
      chosen.value = id;
    }
    newName.value = "";
    await load();
    toast({
      title: t("pages.utility.collections.created", { name }),
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.collections.create_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}
</script>

<template>
  <template v-if="mySteamId && triggerClass">
    <FiveStackToolTip
      as-child
      :side="placement === 'below' ? 'bottom' : 'top'"
      :delay-duration="120"
      :tap-toggle="false"
    >
      <template #trigger>
        <button
          ref="triggerRef"
          type="button"
          :class="memberOf.size ? (triggerActiveClass ?? triggerClass) : triggerClass"
          :data-state="open ? 'open' : 'closed'"
          aria-haspopup="dialog"
          :aria-expanded="open"
          :aria-label="$t('pages.utility.fork.collection')"
          @click="open = !open"
        >
          <Library class="h-4 w-4" />
        </button>
      </template>
      {{ $t("pages.utility.fork.collection") }}
    </FiveStackToolTip>

    <!-- Positioned against the dock, so it is exactly as wide as the panel and
         grows out of the bar the tile sits in. role=dialog + data-state is what
         tells the panel underneath that Escape is not its to take. -->
    <Transition
      enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
      :enter-from-class="
        placement === 'below'
          ? '-translate-y-3 opacity-0'
          : 'translate-y-3 opacity-0'
      "
      :leave-to-class="
        placement === 'below'
          ? '-translate-y-3 opacity-0'
          : 'translate-y-3 opacity-0'
      "
    >
      <div
        v-if="open"
        ref="sheetRef"
        role="dialog"
        data-state="open"
        tabindex="-1"
        :aria-label="$t('pages.utility.fork.collection')"
        class="absolute inset-x-0 z-10 bg-[#1e1e22] px-3 pb-3 pt-2.5 outline-none"
        :class="
          placement === 'below'
            ? 'top-full rounded-b-xl border-b border-white/10 shadow-[0_18px_36px_-14px_rgba(0,0,0,0.9)]'
            : 'bottom-full rounded-t-xl border-t border-white/10 shadow-[0_-18px_36px_-14px_rgba(0,0,0,0.9)]'
        "
      >
        <div class="flex items-center justify-between gap-2 pb-1.5 pl-1">
          <h3 class="text-sm font-semibold">
            {{ $t("pages.utility.fork.collection") }}
          </h3>
          <button
            type="button"
            class="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            :aria-label="$t('common.close')"
            @click="close()"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div v-if="loading && !collections.length" class="flex justify-center py-6">
          <Spinner />
        </div>

        <template v-else>
          <!-- Each collection is a row you tick: what this lineup is already
               in is the first thing the sheet shows. -->
          <ul
            v-if="collections.length"
            class="max-h-52 space-y-0.5 overflow-y-auto overscroll-contain"
          >
            <li v-for="collection of collections" :key="collection.id">
              <button
                type="button"
                role="checkbox"
                :aria-checked="memberOf.has(collection.id)"
                class="flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                @click="toggle(collection)"
              >
                <span
                  class="grid size-5 shrink-0 place-items-center rounded-md border transition-colors"
                  :class="
                    memberOf.has(collection.id)
                      ? 'border-transparent bg-[hsl(var(--tac-amber))] text-[#1a1a1a]'
                      : 'border-white/25'
                  "
                >
                  <Check
                    v-if="memberOf.has(collection.id)"
                    class="h-3.5 w-3.5"
                    :stroke-width="3"
                  />
                </span>
                <span class="min-w-0 flex-1 truncate text-sm">
                  {{ collection.name }}
                </span>
                <span
                  class="shrink-0 font-mono text-[0.68rem] tabular-nums text-muted-foreground"
                >
                  {{
                    $t("pages.utility.collections.count", {
                      count: collection.items_aggregate?.aggregate?.count ?? 0,
                    })
                  }}
                </span>
              </button>
            </li>
          </ul>

          <form
            class="flex items-center gap-2"
            :class="
              collections.length ? 'mt-2 border-t border-white/[0.06] pt-3' : 'pt-1'
            "
            @submit.prevent="create()"
          >
            <Input
              v-model="newName"
              class="h-9 text-base sm:text-sm"
              :placeholder="$t('pages.utility.collections.new_placeholder')"
              :aria-label="$t('pages.utility.collections.new_placeholder')"
            />
            <Button
              type="submit"
              variant="outline"
              class="h-9 shrink-0"
              :disabled="!newName.trim()"
            >
              <Plus class="mr-1 h-4 w-4" />
              {{ $t("common.create") }}
            </Button>
          </form>
          <p class="mt-2 px-1 text-[0.7rem] leading-snug text-muted-foreground">
            {{ $t("pages.utility.collections.hint") }}
          </p>
        </template>
      </div>
    </Transition>
  </template>

  <Popover v-else-if="mySteamId" v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm">
        <Library class="mr-1 h-4 w-4" />
        {{ chosenName ?? $t("pages.utility.collections.add_to") }}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-[min(92vw,320px)] p-2">
      <div v-if="loading" class="flex items-center justify-center py-6">
        <Spinner />
      </div>

      <template v-else>
        <div v-if="collections.length" class="space-y-0.5">
          <button
            v-for="collection of collections"
            :key="collection.id"
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
            @click="toggle(collection)"
          >
            <span class="min-w-0 truncate text-left">
              {{ collection.name }}
            </span>
            <span class="flex shrink-0 items-center gap-2">
              <span class="font-mono text-[0.6rem] tabular-nums opacity-60">
                {{ collection.items_aggregate?.aggregate?.count ?? 0 }}
              </span>
              <Check
                v-if="
                  chooserMode
                    ? chosen === collection.id
                    : memberOf.has(collection.id)
                "
                class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
              />
            </span>
          </button>
        </div>
        <p v-else class="px-2 py-3 text-xs text-muted-foreground">
          {{ $t("pages.utility.collections.empty") }}
        </p>

        <Separator class="my-2" />

        <div class="flex items-center gap-1.5">
          <Input
            v-model="newName"
            class="h-8 text-xs"
            :placeholder="$t('pages.utility.collections.new_placeholder')"
            @keydown.enter.prevent="create()"
          />
          <Button
            size="icon"
            variant="outline"
            class="h-8 w-8 shrink-0"
            :disabled="!newName.trim()"
            :title="$t('pages.utility.collections.create')"
            @click="create()"
          >
            <Plus class="h-4 w-4" />
          </Button>
        </div>
        <p
          class="mt-1.5 flex items-center gap-1.5 px-1 text-[0.65rem] text-muted-foreground"
        >
          <FolderPlus class="h-3 w-3 shrink-0" />
          {{
            chooserMode
              ? $t("pages.utility.collections.hint_choose")
              : $t("pages.utility.collections.hint")
          }}
        </p>
      </template>
    </PopoverContent>
  </Popover>
</template>
