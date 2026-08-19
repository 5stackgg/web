<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import GamePluginCard from "~/components/game-plugins/GamePluginCard.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Button } from "~/components/ui/button";
import AddCustomPluginForm from "~/components/game-plugins/AddCustomPluginForm.vue";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Search, LibraryBig, Plus } from "lucide-vue-next";

definePageMeta({
  middleware: "admin",
  // The kind filter lives in the URL so it can be linked to, but it is a filter,
  // not a different page: without this the page key changes and the whole route
  // remounts on every tab, which reads as a flash.
  persistQueryKeys: ["kind"],
});
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-6 p-4 lg:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-col gap-2">
          <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <LibraryBig class="h-6 w-6" />
            {{ $t("pages.plugins.title") }}
          </h1>
          <p class="text-muted-foreground">
            {{ $t("pages.plugins.description") }}
          </p>
        </div>

        <Button variant="outline" class="gap-2" @click="adding = true">
          <Plus class="h-4 w-4" />
          {{ $t("pages.plugins.custom.add") }}
        </Button>
      </div>

      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="relative flex-1">
          <Search
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="search"
            class="pl-9"
            :placeholder="$t('pages.plugins.search')"
          />
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <AnimatedFilters v-model="kind" square :options="kindOptions" />
          <AnimatedFilters v-model="state" square :options="stateOptions" />
        </div>
      </div>

      <p
        v-if="filtered.length === 0"
        class="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground"
      >
        {{ $t("pages.plugins.empty") }}
      </p>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" v-else>
        <GamePluginCard
          v-for="plugin in filtered"
          :key="plugin.slug"
          :plugin="plugin"
          :installed="isInstalled(plugin)"
          :state="plugin.kind === 'panel' ? null : plugin.install_state"
          :installed-nodes="plugin.installed_node_count"
          :total-nodes="plugin.target_node_count"
        />
      </div>
    </div>
  </PageTransition>

  <Sheet :open="adding" @update:open="adding = $event">
    <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>{{ $t("pages.plugins.custom.title") }}</SheetTitle>
        <SheetDescription>
          {{ $t("pages.plugins.custom.description") }}
        </SheetDescription>
      </SheetHeader>

      <div class="py-6">
        <AddCustomPluginForm @added="onAdded" />
      </div>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  data() {
    return {
      search: "",
      kind: "all",
      state: "all",
      adding: false,
      plugins: [] as Array<Record<string, any>>,
      installedPages: [] as Array<Record<string, any>>,
    };
  },
  created() {
    const kind = this.$route.query.kind;

    if (typeof kind === "string" && ["game", "panel", "bundle"].includes(kind)) {
      this.kind = kind;
    }
  },
  watch: {
    kind(value: string) {
      void this.$router.replace({
        query: value === "all" ? {} : { kind: value },
      });
    },
  },
  apollo: {
    installedPages: {
      query: typedGql("query")({
        custom_pages: [{}, { slug: true, plugin_slug: true, title: true }],
      }),
      update(data: { custom_pages: Array<Record<string, any>> }) {
        return data.custom_pages;
      },
    },
    plugins: {
      query: typedGql("query")({
        game_plugins: [
          {},
          {
            slug: true,
            kind: true,
            name: true,
            author: true,
            description: true,
            homepage: true,
            tags: true,
            verified: true,
            source: true,
            requires_service: true,
            panel: true,
            install_state: true,
            installed_node_count: true,
            target_node_count: true,
            versions: [
              {},
              {
                runtime: true,
                version: true,
                published_at: true,
              },
            ],
          },
        ],
      }),
      update(data: { game_plugins: Array<Record<string, any>> }) {
        return data.game_plugins;
      },
    },
  },
  methods: {
    async onAdded(slug: string) {
      this.adding = false;
      await (this as any).$apollo.queries.plugins.refetch();

      if (slug) {
        void this.$router.push(`/plugins/${slug}`);
      }
    },
    // Two different questions behind one word. A panel plugin is installed when
    // the panel has a page for it; a game plugin when nodes have it on disk.
    isInstalled(plugin: Record<string, any>): boolean {
      if (plugin.kind === "panel") {
        return this.isPanelInstalled(plugin);
      }

      const installed = ["Installed", "Partial", "Pending", "Manual"].includes(
        plugin.install_state,
      );

      return plugin.kind === "bundle"
        ? installed || this.isPanelInstalled(plugin)
        : installed;
    },
    // An operator hosts a panel plugin themselves, so the URL they registered
    // has nothing in common with the catalog entry. The /apps/<slug> route the
    // plugin claims is fixed by its author, so that is what identifies it.
    isPanelInstalled(plugin: Record<string, any>): boolean {
      const routeSlug = plugin.panel?.slug;

      return this.installedPages.some(
        (page) =>
          page.plugin_slug === plugin.slug ||
          (routeSlug && page.slug === routeSlug),
      );
    },
  },
  computed: {
    stateOptions() {
      const installed = this.plugins.filter((plugin: Record<string, any>) =>
        this.isInstalled(plugin),
      ).length;

      return [
        { key: "all", label: this.$t("pages.plugins.kinds.all") },
        {
          key: "installed",
          label: this.$t("pages.plugins.filter_installed"),
          count: installed,
        },
        {
          key: "available",
          label: this.$t("pages.plugins.filter_available"),
          count: this.plugins.length - installed,
        },
      ];
    },
    // Built from what the catalog actually holds. A bundle is one repo shipping
    // both halves, which nothing does yet -- and a tab that is always empty is
    // worse than no tab.
    kindOptions() {
      const present = new Set(
        this.plugins.map((plugin: Record<string, any>) => plugin.kind),
      );

      return [
        { key: "all", label: this.$t("pages.plugins.kinds.all") },
        ...["game", "panel", "bundle"]
          .filter((kind) => present.has(kind))
          .map((kind) => ({
            key: kind,
            label: this.$t(`pages.plugins.kinds.${kind}`),
          })),
      ];
    },
    filtered() {
      const search = this.search.trim().toLowerCase();

      return this.plugins.filter((plugin) => {
        if (this.kind !== "all" && plugin.kind !== this.kind) {
          return false;
        }

        if (this.state !== "all") {
          const installed = this.isInstalled(plugin);

          if (this.state === "installed" && !installed) {
            return false;
          }

          if (this.state === "available" && installed) {
            return false;
          }
        }

        if (search.length === 0) {
          return true;
        }

        return [plugin.name, plugin.description, plugin.author, ...(plugin.tags ?? [])]
          .filter(Boolean)
          .some((field: string) => field.toLowerCase().includes(search));
      });
    },
  },
};
</script>
