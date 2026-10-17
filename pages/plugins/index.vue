<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterChip from "~/components/common/FilterChip.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import PluginStoreCard from "~/components/plugins/PluginStoreCard.vue";
import AddCustomPluginForm from "~/components/game-plugins/AddCustomPluginForm.vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Search, Plus, X } from "lucide-vue-next";
import { listCreateButtonClasses } from "~/utilities/tacticalClasses";

definePageMeta({
  middleware: "admin",
  // The kind filter lives in the URL so it can be linked to, but it is a filter,
  // not a different page: without this the page key changes and the whole route
  // remounts on every tab, which reads as a flash.
  persistQueryKeys: ["kind"],
});
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.plugins.title") }}</h1>

  <PageTransition :delay="0">
    <div class="flex flex-wrap items-center gap-2">
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          v-model="search"
          autocomplete="off"
          :placeholder="$t('pages.plugins.search')"
          :aria-label="$t('pages.plugins.search')"
          class="h-full text-sm"
        />
        <InputGroupAddon align="inline-end" class="pr-2">
          <button
            v-if="search"
            type="button"
            class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :aria-label="$t('common.reset_filters')"
            @click="search = ''"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>

      <div
        class="max-w-full overflow-x-auto [scrollbar-width:none] max-md:order-last"
      >
        <AnimatedFilters v-model="state" square :options="stateOptions" />
      </div>

      <FilterMenu
        :count="menuFilterCount"
        :active="menuFilterCount > 0"
        :show-reset="menuFilterCount > 0"
        align="start"
        content-class="w-[min(90vw,300px)] space-y-3 p-3"
        @reset="resetMenuFilters"
      >
        <div v-if="kindOptions.length > 1" class="space-y-1.5">
          <span
            class="block px-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.plugins.store.filter_kind") }}
          </span>
          <div class="flex flex-wrap gap-1.5">
            <FilterChip
              v-for="option in kindOptions"
              :key="option.key"
              :label="option.label"
              :active="kind === option.key"
              @toggle="kind = kind === option.key ? 'all' : option.key"
            />
          </div>
        </div>
        <div class="space-y-1.5">
          <span
            class="block px-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.plugins.store.filter_review") }}
          </span>
          <FilterToggle
            v-model="verifiedOnly"
            :label="$t('pages.plugins.store.verified_only')"
          />
        </div>
      </FilterMenu>

      <span
        class="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex"
      >
        {{ $t("pages.plugins.store.runtime") }}
        <b class="font-semibold text-foreground">{{ runtimeName }}</b>
      </span>

      <Button
        size="sm"
        :class="[listCreateButtonClasses, 'max-lg:ml-auto']"
        :title="$t('pages.plugins.custom.add')"
        @click="adding = true"
      >
        <Plus class="h-4 w-4" />
        <span class="max-md:sr-only">{{ $t("pages.plugins.custom.add") }}</span>
      </Button>
    </div>
  </PageTransition>

  <PageTransition :delay="60" class="mt-6">
    <FadeSwap>
      <div
        v-if="!pluginsLoaded"
        key="loading"
        class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]"
      >
        <Skeleton v-for="n in 6" :key="n" class="h-[232px] rounded-lg" />
      </div>

      <SectionEmpty
        v-else-if="filtered.length === 0"
        key="empty"
        :title="
          nothingInstalled
            ? $t('pages.plugins.store.empty_installed_title')
            : $t('pages.plugins.store.empty_title')
        "
        :description="
          nothingInstalled
            ? $t('pages.plugins.store.empty_installed_hint')
            : $t('pages.plugins.empty')
        "
      >
        <Button size="sm" variant="outline" @click="clearFilters">
          {{ $t("pages.plugins.store.show_all") }}
        </Button>
      </SectionEmpty>

      <div
        v-else
        :key="`grid-${state}-${kind}-${verifiedOnly}`"
        class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]"
      >
        <PluginStoreCard
          v-for="plugin in filtered"
          :key="plugin.slug"
          :plugin="plugin"
          :state="cardStates[plugin.slug]"
          :runtime="runtime"
          :panel-route="panelRoute(plugin)"
          :busy="busy === plugin.slug"
          @install="install(plugin)"
          @retry="retry(plugin)"
          @update="update(plugin, $event)"
        />
      </div>
    </FadeSwap>
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
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "~/components/ui/toast";
import {
  isPluginInstalled,
  needsAttention,
  pluginCardState,
  retryVersion,
  runtimeLabel,
  type DesiredInstall,
  type PluginCardState,
} from "~/components/plugins/pluginDirectoryState";

const KINDS = ["game", "panel", "bundle"];
const ONLINE = new Set(["Online", "NotAcceptingNewMatches"]);

export default {
  data() {
    return {
      search: "",
      kind: "all",
      state: "all",
      verifiedOnly: false,
      adding: false,
      busy: null as string | null,
      pluginsLoaded: false,
      plugins: [] as Array<Record<string, any>>,
      installedPages: [] as Array<Record<string, any>>,
      desired: [] as Array<DesiredInstall>,
      nodeInstalls: [] as Array<Record<string, any>>,
      nodes: [] as Array<Record<string, any>>,
    };
  },
  created() {
    const kind = this.$route.query.kind;

    if (typeof kind === "string" && KINDS.includes(kind)) {
      this.kind = kind;
    }
  },
  watch: {
    kind(value: string) {
      void this.$router.replace({
        query: value === "all" ? {} : { kind: value },
      });
    },
    // The attention tab only exists while something needs it; once the last
    // failure clears, the list it was showing is gone with it.
    attentionCount(count: number) {
      if (count === 0 && this.state === "attention") {
        this.state = "all";
      }
    },
  },
  apollo: {
    $subscribe: {
      // Live, so a rollout's meter moves while you watch it rather than
      // showing whatever it was when the page loaded.
      plugins: {
        query: typedGql("subscription")({
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
              requires_server_guidelines_disabled: true,
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
        result: function ({ data }: { data: Record<string, any> }) {
          this.plugins = data?.game_plugins ?? [];
          this.pluginsLoaded = true;
        },
      },
      // The pinned version is what an update moves; install_state alone
      // cannot say a newer release is waiting.
      desired: {
        query: typedGql("subscription")({
          game_plugin_installs: [
            {},
            { plugin_slug: true, version: true, channel: true },
          ],
        }),
        result: function ({ data }: { data: Record<string, any> }) {
          this.desired = data?.game_plugin_installs ?? [];
        },
      },
      // Bounded by plugins times nodes. Only read to name the node a rollout
      // failed on.
      nodeInstalls: {
        query: typedGql("subscription")({
          game_server_node_plugins: [
            {},
            { plugin_slug: true, game_server_node_id: true, status: true },
          ],
        }),
        result: function ({ data }: { data: Record<string, any> }) {
          this.nodeInstalls = data?.game_server_node_plugins ?? [];
        },
      },
      nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {},
            { id: true, label: true, status: true, enabled: true },
          ],
        }),
        result: function ({ data }: { data: Record<string, any> }) {
          this.nodes = data?.game_server_nodes ?? [];
        },
      },
    },
    installedPages: {
      query: typedGql("query")({
        custom_pages: [{}, { slug: true, plugin_slug: true, title: true }],
      }),
      update(data: { custom_pages: Array<Record<string, any>> }) {
        return data.custom_pages;
      },
    },
  },
  methods: {
    async onAdded(slug: string) {
      this.adding = false;

      if (slug) {
        void this.$router.push(`/plugins/${slug}`);
      }
    },
    // An operator hosts a panel plugin themselves, so the URL they registered
    // has nothing in common with the catalog entry. The /apps/<slug> route the
    // plugin claims is fixed by its author, so that is what identifies it.
    panelPage(plugin: Record<string, any>): Record<string, any> | null {
      const routeSlug = plugin.panel?.slug;

      return (
        this.installedPages.find(
          (page) =>
            page.plugin_slug === plugin.slug ||
            (routeSlug && page.slug === routeSlug),
        ) ?? null
      );
    },
    panelRoute(plugin: Record<string, any>): string | null {
      return this.panelPage(plugin)?.slug ?? null;
    },
    desiredFor(slug: string): DesiredInstall | null {
      return this.desired.find((row) => row.plugin_slug === slug) ?? null;
    },
    clearFilters() {
      this.search = "";
      this.state = "all";
      this.resetMenuFilters();
    },
    resetMenuFilters() {
      this.kind = "all";
      this.verifiedOnly = false;
    },
    async mutate(
      plugin: Record<string, any>,
      version: string | undefined,
      title: string,
    ) {
      if (this.busy) {
        return;
      }

      this.busy = plugin.slug;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            installGamePlugin: [
              version ? { slug: plugin.slug, version } : { slug: plugin.slug },
              { success: true },
            ],
          }),
        });

        toast({ title });
      } catch (error) {
        toast({ title: (error as Error).message, variant: "destructive" });
      } finally {
        this.busy = null;
      }
    },
    install(plugin: Record<string, any>) {
      return this.mutate(
        plugin,
        undefined,
        this.$t("pages.plugins.store.installing_toast", {
          name: plugin.name,
        }) as string,
      );
    },
    retry(plugin: Record<string, any>) {
      return this.mutate(
        plugin,
        retryVersion(this.desiredFor(plugin.slug)),
        this.$t("pages.plugins.store.retry_toast", {
          name: plugin.name,
        }) as string,
      );
    },
    update(plugin: Record<string, any>, version: string) {
      return this.mutate(
        plugin,
        version,
        this.$t("pages.plugins.store.update_toast", { version }) as string,
      );
    },
  },
  computed: {
    runtime(): string {
      return useApplicationSettingsStore().gameServerPluginRuntime;
    },
    runtimeName(): string {
      return runtimeLabel(this.runtime);
    },
    // Counted the way install_state counts: enabled nodes that are up.
    failedNodesBySlug(): Record<string, string[]> {
      const labels = new Map(
        this.nodes
          .filter((node) => node.enabled !== false && ONLINE.has(node.status))
          .map((node) => [node.id, node.label || node.id]),
      );
      const out: Record<string, string[]> = {};

      for (const row of this.nodeInstalls) {
        const label = labels.get(row.game_server_node_id);
        if (row.status !== "Failed" || !label) {
          continue;
        }
        (out[row.plugin_slug] ??= []).push(label);
      }

      return out;
    },
    cardStates(): Record<string, PluginCardState> {
      const out: Record<string, PluginCardState> = {};

      for (const plugin of this.plugins) {
        out[plugin.slug] = pluginCardState(plugin as any, {
          runtime: this.runtime,
          desired: this.desiredFor(plugin.slug),
          panelInstalled: !!this.panelPage(plugin),
          failedNodes: this.failedNodesBySlug[plugin.slug] ?? [],
        });
      }

      return out;
    },
    installedSlugs(): Set<string> {
      return new Set(
        this.plugins
          .filter((plugin) =>
            isPluginInstalled(plugin as any, !!this.panelPage(plugin)),
          )
          .map((plugin) => plugin.slug),
      );
    },
    attentionCount(): number {
      return this.plugins.filter((plugin) =>
        needsAttention(this.cardStates[plugin.slug]),
      ).length;
    },
    nothingInstalled(): boolean {
      return this.state === "installed" && this.installedSlugs.size === 0;
    },
    stateOptions() {
      return [
        { key: "all", label: this.$t("pages.plugins.kinds.all") },
        { key: "installed", label: this.$t("pages.plugins.filter_installed") },
        { key: "available", label: this.$t("pages.plugins.filter_available") },
        ...(this.attentionCount > 0
          ? [
              {
                key: "attention",
                label: this.$t("pages.plugins.store.needs_attention"),
                count: this.attentionCount,
              },
            ]
          : []),
      ];
    },
    // Built from what the catalog actually holds. A bundle is one repo shipping
    // both halves, which nothing does yet -- and a choice that is always empty
    // is worse than no choice.
    kindOptions(): Array<{ key: string; label: string }> {
      const present = new Set(this.plugins.map((plugin) => plugin.kind));

      return KINDS.filter((kind) => present.has(kind)).map((kind) => ({
        key: kind,
        label: this.$t(`pages.plugins.kinds.${kind}`) as string,
      }));
    },
    menuFilterCount(): number {
      return (this.kind !== "all" ? 1 : 0) + (this.verifiedOnly ? 1 : 0);
    },
    filtered(): Array<Record<string, any>> {
      const search = this.search.trim().toLowerCase();

      return this.plugins.filter((plugin) => {
        if (this.kind !== "all" && plugin.kind !== this.kind) {
          return false;
        }

        if (this.verifiedOnly && !plugin.verified) {
          return false;
        }

        const installed = this.installedSlugs.has(plugin.slug);

        if (this.state === "installed" && !installed) {
          return false;
        }

        if (this.state === "available" && installed) {
          return false;
        }

        if (
          this.state === "attention" &&
          !needsAttention(this.cardStates[plugin.slug])
        ) {
          return false;
        }

        if (search.length === 0) {
          return true;
        }

        return [
          plugin.name,
          plugin.description,
          plugin.author,
          ...(plugin.tags ?? []),
        ]
          .filter(Boolean)
          .some((field: string) => field.toLowerCase().includes(search));
      });
    },
  },
};
</script>
