<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Check, FolderPlus, Library, Plus } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
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
  }>(),
  {
    lineupId: null,
  },
);

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
  <Popover v-if="mySteamId" v-model:open="open">
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
            class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
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
