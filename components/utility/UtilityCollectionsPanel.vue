<script setup lang="ts">
/**
 * The missing half of collections.
 *
 * You could add a lineup to one from the save dialog, the fork dialog and the
 * lineup dialog -- and then never see it again, because nothing browsed them.
 * The practice dialog's "load a collection" was the only consumer, which is
 * why the concept read as something from nowhere.
 */
import { computed, ref, watch } from "vue";
import { Library, Lock, Users } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityCollectionsQuery } from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityCollection } from "~/types/utility";

const props = defineProps<{ mapName: string }>();

const emit = defineEmits<{ (e: "open", id: string): void }>();

const collections = ref<UtilityCollection[]>([]);
const loading = ref(false);

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

async function load() {
  if (!mySteamId.value) {
    collections.value = [];
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
</script>

<template>
  <div class="flex flex-col gap-2 pt-2">
    <p
      v-if="!loading && collections.length === 0"
      class="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground"
    >
      {{ $t("pages.utility.collections.empty") }}
    </p>

    <!-- Same shell as a lineup card, so the strip reads as one list. -->
    <button
      v-for="collection of collections"
      :key="collection.id"
      type="button"
      class="group flex flex-col rounded-md border border-l-2 border-l-border bg-card/40 p-3 text-left transition-colors duration-150 hover:border-l-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber))]/[0.04] [backdrop-filter:blur(6px)]"
      @click="emit('open', collection.id)"
    >
      <span class="flex items-center gap-2">
        <Library class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
        <span class="truncate text-sm font-medium">{{ collection.name }}</span>
        <Lock v-if="!collection.can_edit" class="ml-auto h-3 w-3 text-muted-foreground" />
      </span>

      <span
        class="mt-1 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        <Users class="h-3 w-3" />
        {{ $t("pages.utility.collections.count", { count: countOf(collection) }) }}
      </span>

      <span
        v-if="collection.description"
        class="mt-1 line-clamp-2 text-xs text-muted-foreground/80"
      >
        {{ collection.description }}
      </span>
    </button>
  </div>
</template>
