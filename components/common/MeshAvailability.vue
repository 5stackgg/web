<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { Boxes, Check, X } from "lucide-vue-next";

type MapRow = { name: string };

const { client: apolloClient } = useApolloClient();
const meshCdn = (useRuntimeConfig().public.mapMeshCdn as string) || "";

const loading = ref(true);
const availableMaps = ref<string[]>([]);
const missingMaps = ref<string[]>([]);

const CACHE_KEY = `mesh-coverage:v1:${meshCdn}`;

const MAPS_QUERY = gql`
  query MeshKnownMaps {
    maps(
      where: { workshop_map_id: { _is_null: true }, enabled: { _eq: true } }
    ) {
      name
    }
  }
`;

function meshName(name: string): string {
  let n = name.toLowerCase().trim();
  const slash = n.lastIndexOf("/");
  if (slash >= 0) {
    n = n.slice(slash + 1);
  }
  return n.replace(/_night$/, "");
}

async function probe(name: string): Promise<boolean | null> {
  if (!meshCdn) {
    return null;
  }
  try {
    const res = await fetch(`${meshCdn}/${name}.tri`, { method: "HEAD" });
    if (res.status === 404) {
      return false;
    }
    if (res.ok) {
      return true;
    }
    return null;
  } catch {
    return null;
  }
}

async function probeRetry(name: string): Promise<boolean | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await probe(name);
    if (result !== null) {
      return result;
    }
  }
  return null;
}

function readCache(): { available: string[]; missing: string[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(value: { available: string[]; missing: string[] }) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    loading.value = false;
  }
}

onMounted(async () => {
  const cached = readCache();
  if (cached) {
    availableMaps.value = cached.available;
    missingMaps.value = cached.missing;
    loading.value = false;
    return;
  }

  try {
    const { data } = await apolloClient.query({
      query: MAPS_QUERY,
      fetchPolicy: "network-only",
    });
    const names = new Set<string>();
    for (const m of ((data as any)?.maps ?? []) as MapRow[]) {
      const key = meshName(m.name);
      if (key) {
        names.add(key);
      }
    }
    const unique = [...names].sort();
    const results = await Promise.all(
      unique.map(async (name) => ({ name, has: await probeRetry(name) })),
    );

    availableMaps.value = results
      .filter((r) => r.has === true)
      .map((r) => r.name);
    missingMaps.value = results
      .filter((r) => r.has !== true)
      .map((r) => r.name);

    if (!results.some((r) => r.has === null)) {
      writeCache({
        available: availableMaps.value,
        missing: missingMaps.value,
      });
    }
  } catch {
    availableMaps.value = [];
    missingMaps.value = [];
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div
    v-if="loading || availableMaps.length || missingMaps.length"
    class="flex flex-col gap-3"
  >
    <span
      class="flex items-center gap-2 font-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase text-[hsl(var(--tac-amber))]"
    >
      <Boxes class="h-4 w-4" />
      {{ $t("glossary.mesh_coverage_title") }}
    </span>
    <p class="text-xs leading-snug text-muted-foreground/80">
      {{ $t("glossary.mesh_coverage_note") }}
    </p>

    <div v-if="loading" class="text-xs text-muted-foreground">
      {{ $t("glossary.mesh_coverage_loading") }}
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <span
          class="flex items-center gap-1.5 text-xs font-semibold text-success"
        >
          <Check class="h-3.5 w-3.5" />
          {{ $t("glossary.mesh_have", { count: availableMaps.length }) }}
        </span>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="name of availableMaps"
            :key="name"
            class="rounded border border-success/40 bg-success/10 px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground/90"
          >
            {{ name }}
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span
          class="flex items-center gap-1.5 text-xs font-semibold text-destructive"
        >
          <X class="h-3.5 w-3.5" />
          {{ $t("glossary.mesh_missing", { count: missingMaps.length }) }}
        </span>
        <div v-if="missingMaps.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="name of missingMaps"
            :key="name"
            class="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground/90"
          >
            {{ name }}
          </span>
        </div>
        <span v-else class="text-xs text-muted-foreground">
          {{ $t("glossary.mesh_missing_none") }}
        </span>
      </div>
    </div>
  </div>
</template>
