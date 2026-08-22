<script setup lang="ts">
/**
 * The missing half of collections.
 *
 * You could add a lineup to one from the save dialog, the fork dialog and the
 * lineup dialog -- and then never see it again, because nothing browsed them.
 * The practice dialog's "load a collection" was the only consumer, which is
 * why the concept read as something from nowhere.
 */
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Library, Lock, Plus, Trash2, Users, X } from "lucide-vue-next";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import DeleteCollectionDialog from "~/components/utility/DeleteCollectionDialog.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import {
  createUtilityCollectionMutation,
  utilityCollectionsQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityCollection } from "~/types/utility";

const props = defineProps<{ mapName: string }>();

const emit = defineEmits<{
  (e: "open", id: string): void;
  // The page puts an add button under whichever panel is showing; while this
  // one is empty it makes the offer itself, and two of the same button one
  // above the other is the page arguing with the panel.
  (e: "empty", value: boolean): void;
}>();

const { t } = useI18n();

const collections = ref<UtilityCollection[]>([]);
// True from the start: the panel mounts and fetches in the same breath, and a
// tab that renders nothing at all for its first frames is the pop-in this
// column had.
const loading = ref(true);

const { skeleton, refreshing } = useDeferredLoading(() => loading.value);

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

async function load() {
  if (!mySteamId.value) {
    collections.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityCollectionsQuery,
      variables: {
        // can_view, not an owner column: a team collection belongs to people
        // who did not create it.
        where: {},
        order_by: [{ created_at: order_by.desc }],
        limit: 100,
      },
      fetchPolicy: "network-only",
    });

    collections.value = (data as any)?.utility_collections ?? [];
  } catch (error) {
    console.error("[utility] collections load error:", error);
    collections.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => [props.mapName, mySteamId.value], load, { immediate: true });

function countOf(collection: UtilityCollection): number {
  return (collection as any)?.items_aggregate?.aggregate?.count ?? 0;
}

const creating = ref(false);
const newName = ref("");
const saving = ref(false);
const nameInput = ref<{ $el?: HTMLElement } | null>(null);

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

async function create() {
  const name = newName.value.trim();
  if (!name || saving.value) {
    return;
  }
  saving.value = true;
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: createUtilityCollectionMutation,
      // No map_name: this panel lists every collection you can see, not the
      // ones stamped with the map you happen to be standing on.
      variables: { object: { name } },
    });
    const id = (data as any)?.insert_utility_collections_one?.id;
    if (!id) {
      throw new Error("no collection");
    }
    cancelCreate();
    await load();
    toast({ title: t("pages.utility.collections.created_empty", { name }) });
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

// Only while it is genuinely bare: mid-fetch the panel does not know yet, and
// flashing the page's button away and back is worse than leaving it alone.
watch(
  () => (loading.value ? null : !collections.value.length && !creating.value),
  (value) => {
    if (value !== null) {
      emit("empty", value);
    }
  },
  { immediate: true },
);

const pendingDelete = ref<UtilityCollection | null>(null);
const deleteOpen = ref(false);

// can_edit is true for a teammate on a team collection, but the delete
// permission filters on owner_steam_id -- so anyone else would get a mutation
// that succeeds and removes nothing.
function canDelete(collection: UtilityCollection): boolean {
  return (
    !!mySteamId.value && `${collection.owner_steam_id}` === `${mySteamId.value}`
  );
}

function askDelete(collection: UtilityCollection) {
  pendingDelete.value = collection;
  deleteOpen.value = true;
}

async function onDeleted(id: string) {
  const name = pendingDelete.value?.name;
  pendingDelete.value = null;
  // Drop it locally first: load() is a network round trip, and leaving the row
  // sitting there until it lands reads as the delete having failed.
  collections.value = collections.value.filter(
    (collection) => collection.id !== id,
  );
  toast({ title: t("pages.utility.collections.deleted", { name }) });
  await load();
}

defineExpose({ startCreate });
</script>

<template>
  <div class="flex flex-col">
    <!-- Above whatever the panel is showing, because naming a new shelf is a
       thing you do TO the list, not an entry in it. -->
    <Fold :open="creating">
      <form class="flex items-center gap-1.5 pt-2" @submit.prevent="create()">
        <Input
          ref="nameInput"
          v-model="newName"
          maxlength="120"
          class="h-8 flex-1 text-sm"
          :placeholder="$t('pages.utility.collections.new_placeholder')"
        />
        <Button
          type="submit"
          size="sm"
          class="tac-amber-cta h-8"
          :disabled="!newName.trim() || saving"
        >
          {{ $t("pages.utility.collections.create") }}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          class="h-8 w-8 shrink-0"
          :title="$t('common.cancel')"
          @click="cancelCreate()"
        >
          <X class="h-4 w-4" />
        </Button>
      </form>
    </Fold>

    <HeightSwap class="pt-2">
      <UtilitySkeletonList
        v-if="skeleton"
        key="loading"
        :count="3"
        shape="row"
      />

      <UtilityEmpty
        v-else-if="!collections.length"
        key="empty"
        :title="$t('pages.utility.collections.empty')"
        :description="$t('pages.utility.collections.empty_description')"
      >
        <Button
          v-if="mySteamId && !creating"
          size="sm"
          variant="outline"
          class="border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.14)]"
          @click="startCreate()"
        >
          <Plus class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.collections.new") }}
        </Button>
      </UtilityEmpty>

      <div
        v-else
        key="list"
        class="flex flex-col gap-2 transition-opacity [transition-duration:180ms]"
        :class="refreshing ? 'pointer-events-none opacity-50' : ''"
      >
        <!-- Same shell as a lineup card, so the strip reads as one list. The
             card itself is the button, so delete has to be a sibling rather
             than a control nested inside one. -->
        <div
          v-for="collection of collections"
          :key="collection.id"
          class="group relative"
        >
          <button
            type="button"
            class="flex w-full flex-col rounded-md border border-l-2 border-l-border bg-card/40 p-3 text-left transition-colors duration-150 hover:border-l-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber))]/[0.04] [backdrop-filter:blur(6px)]"
            @click="emit('open', collection.id)"
          >
            <span class="flex items-center gap-2">
              <Library class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
              <span class="truncate text-sm font-medium">{{
                collection.name
              }}</span>
              <!-- Padded past the trash so a long name never runs under it. -->
              <span
                v-if="canDelete(collection)"
                class="ml-auto w-5 shrink-0"
              ></span>
              <Lock
                v-if="!collection.can_edit"
                class="ml-auto h-3 w-3 text-muted-foreground"
              />
            </span>

            <span
              class="mt-1 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              <Users class="h-3 w-3" />
              {{
                $t("pages.utility.collections.count", {
                  count: countOf(collection),
                })
              }}
            </span>

            <span
              v-if="collection.description"
              class="mt-1 line-clamp-2 text-xs text-muted-foreground/80"
            >
              {{ collection.description }}
            </span>
          </button>

          <!-- Always rendered rather than revealed on hover: this list is a
               touch surface too, and a hover-only control is unreachable
               there. -->
          <button
            v-if="canDelete(collection)"
            type="button"
            class="absolute right-2 top-2.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
            :title="$t('pages.utility.collections.delete')"
            :aria-label="$t('pages.utility.collections.delete')"
            @click.stop="askDelete(collection)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </HeightSwap>

    <DeleteCollectionDialog
      v-model="deleteOpen"
      :collection-id="pendingDelete?.id ?? null"
      :name="pendingDelete?.name ?? null"
      @deleted="onDeleted"
    />
  </div>
</template>
