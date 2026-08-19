<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import PluginReadme from "~/components/game-plugins/PluginReadme.vue";
import { Switch } from "~/components/ui/switch";
import {
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  ArrowLeft,
  LayoutDashboard,
  Check,
  ChevronDown,
  ArrowRight,
  Puzzle,
  Package,
  Settings2,
  FolderOpen,
  Download,
  Wrench,
} from "lucide-vue-next";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-6 p-4 lg:p-6" v-if="plugin">
      <NuxtLink to="/plugins">
        <Button variant="ghost" size="sm" class="gap-2 -ml-2">
          <ArrowLeft class="h-4 w-4" />
          {{ $t("pages.plugins.back") }}
        </Button>
      </NuxtLink>

      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-semibold tracking-tight">
              {{ plugin.name }}
            </h1>
            <Badge v-if="installedPage" variant="secondary" class="gap-1">
              <Check class="h-3 w-3" />
              {{ $t("pages.plugins.installed") }}
            </Badge>
            <Badge v-if="plugin.verified" variant="outline" class="gap-1">
              <ShieldCheck class="h-3 w-3" />
              {{ $t("pages.plugins.verified") }}
            </Badge>
            <Badge
              v-if="plugin.source === 'custom'"
              variant="outline"
              class="gap-1"
            >
              <Wrench class="h-3 w-3" />
              {{ $t("pages.plugins.custom.badge") }}
            </Badge>
            <!-- Worth knowing before installing, not only once the toggle is
                 in front of you. -->
            <Badge
              v-if="plugin.requires_server_guidelines_disabled"
              variant="outline"
              class="gap-1 border-yellow-500/40 text-yellow-300"
            >
              <AlertTriangle class="h-3 w-3" />
              {{ $t("pages.plugins.guidelines.badge") }}
            </Badge>
          </div>
          <p class="text-sm text-muted-foreground">
            <a
              v-if="authorUrl"
              :href="authorUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              {{ $t("pages.plugins.by", { author: plugin.author }) }}
              <ExternalLink class="h-3 w-3" />
            </a>
            <template v-else>
              {{ $t("pages.plugins.by", { author: plugin.author }) }}
            </template>
          </p>
        </div>

        <a
          v-if="plugin.homepage"
          :href="plugin.homepage"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" class="gap-2">
            <ExternalLink class="h-4 w-4" />
            {{ $t("pages.plugins.source") }}
          </Button>
        </a>
      </div>

      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div class="min-w-0 space-y-6">
          <p class="text-muted-foreground">{{ plugin.description }}</p>

          <!-- A plugin built for both frameworks is two repositories with two
               READMEs. Showing only the homepage's one silently hides half the
               documentation, so each variant gets a tab. -->
          <div v-if="readmeVariants.length > 1" class="flex items-center gap-3">
            <AnimatedFilters
              v-model="readmeRuntime"
              square
              :options="readmeVariants"
            />
            <a
              v-if="readmeRepo"
              :href="`https://github.com/${readmeRepo}`"
              target="_blank"
              rel="noopener noreferrer"
              class="min-w-0 truncate font-mono text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {{ readmeRepo }}
            </a>
          </div>

          <PluginReadme
            v-if="readme"
            :content="readme"
            :format="readmeFormat"
          />

          <p
            v-else-if="readmeLoading"
            class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
          >
            {{ $t("pages.plugins.readme_loading") }}
          </p>

          <p
            v-else-if="readmeLoaded"
            class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
          >
            {{ $t("pages.plugins.no_readme") }}
          </p>
        </div>

        <aside class="space-y-4 lg:sticky lg:top-6">
          <!-- A panel plugin is installed on the machine hosting the panel, not onto
               a game node, so it gets its own treatment rather than a node list.
               Installed and not-installed are different states, not one card with a
               line of text swapped: the old version still read "Install this panel
               plugin" while telling you it was already installed. -->
          <!-- Sits in a ~20rem rail, so the actions stack full width: side by side
               they clipped to "OPEN 5STACK INVEN...". The amber is pulled back to a
               dot and the one primary button -- a plugin merely being installed is
               not a condition worth lighting the whole card up for. -->
          <Card v-if="isPanelPlugin && installedPage" class="overflow-hidden">
            <div
              class="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5"
            >
              <span
                class="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--tac-amber))]"
              ></span>
              <h3
                class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ $t("pages.plugins.live_title") }}
              </h3>
            </div>

            <CardContent class="flex items-center gap-2.5 p-5 sm:p-5">
              <NuxtLink
                :to="`/apps/${installedPage.slug}`"
                class="group min-w-0 flex-1"
              >
                <Button variant="tactical" class="w-full gap-2">
                  {{ $t("pages.plugins.open_plugin") }}
                  <ArrowRight
                    class="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </Button>
              </NuxtLink>

              <!-- Icon only, so the row stays one line in the rail. The label still
                   exists for anyone not looking at it. -->
              <NuxtLink to="/settings/application/plugins" class="shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  :aria-label="$t('pages.plugins.manage')"
                  :title="$t('pages.plugins.manage')"
                >
                  <Settings2 class="h-4 w-4" />
                </Button>
              </NuxtLink>
            </CardContent>
          </Card>

          <Card v-else-if="isPanelPlugin">
            <CardHeader>
              <CardTitle class="flex items-center gap-2 text-base">
                <LayoutDashboard class="h-4 w-4" />
                {{ $t("pages.plugins.panel_install_title") }}
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <p class="text-sm text-muted-foreground">
                {{ $t("pages.plugins.panel_install_hint") }}
              </p>

              <ol class="space-y-4">
                <li class="flex gap-3">
                  <span
                    class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[0.65rem] text-muted-foreground"
                    >1</span
                  >
                  <div class="min-w-0 flex-1 space-y-2">
                    <p class="text-sm">{{ $t("pages.plugins.panel_step_deploy") }}</p>
                    <pre
                      class="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-sm"
                    ><code>{{ panelInstallCommand }}</code></pre>
                  </div>
                </li>
                <li class="flex gap-3">
                  <span
                    class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[0.65rem] text-muted-foreground"
                    >2</span
                  >
                  <p class="flex-1 text-sm">{{ $t("pages.plugins.panel_step_dns") }}</p>
                </li>
                <li class="flex gap-3">
                  <span
                    class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[0.65rem] text-muted-foreground"
                    >3</span
                  >
                  <p class="flex-1 text-sm">
                    {{ $t("pages.plugins.panel_step_register") }}
                  </p>
                </li>
              </ol>

              <a
                href="https://docs.5stack.gg/plugins/installing"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-sm text-[hsl(var(--tac-amber))] underline-offset-4 hover:underline"
              >
                {{ $t("pages.plugins.panel_install_docs") }}
                <ExternalLink class="h-3 w-3" />
              </a>
            </CardContent>
          </Card>

          <Card v-if="isAdministrator && plugin.kind !== 'panel'">
            <CardContent class="space-y-3 p-5 sm:p-5">
              <p v-if="!availableForRuntime" class="text-sm text-muted-foreground">
                {{
                  $t("pages.plugins.unavailable_for_runtime", {
                    runtime: runtimeLabel,
                  })
                }}
              </p>

              <p v-else-if="nodes.length === 0" class="text-sm text-muted-foreground">
                {{ $t("pages.plugins.no_nodes") }}
              </p>

              <template v-else>
                <div class="space-y-2">
                  <Button
                    v-if="installedNodeCount < nodes.length"
                    variant="tactical"
                    class="w-full gap-2"
                    :loading="busy === ALL_NODES"
                    @click="install()"
                  >
                    <Download class="h-4 w-4" />
                    {{ $t("pages.plugins.install") }}
                  </Button>

                  <template v-if="installedNodeCount > 0">
                    <p class="text-center text-xs text-muted-foreground">
                      {{
                        $t("pages.plugins.installed_on", {
                          installed: installedNodeCount,
                          total: nodes.length,
                        })
                      }}
                    </p>
                    <Button
                      variant="outline"
                      class="w-full"
                      :loading="busy === ALL_NODES"
                      @click="uninstall()"
                    >
                      {{ $t("pages.plugins.uninstall") }}
                    </Button>
                  </template>

                  <!-- Only an entry this deployment authored can be taken out of
                       the catalog; a registry one would come back on the next
                       sync. Removal waits until nothing is installed, so the
                       files are gone from the nodes before the entry that
                       describes them is. -->
                  <template v-if="canRemoveFromCatalog">
                    <Button
                      variant="ghost"
                      class="w-full text-destructive hover:text-destructive"
                      :loading="removingFromCatalog"
                      @click="removeFromCatalog()"
                    >
                      {{ $t("pages.plugins.custom.remove") }}
                    </Button>
                  </template>
                  <p
                    v-else-if="plugin.source === 'custom'"
                    class="text-center text-xs text-muted-foreground"
                  >
                    {{ $t("pages.plugins.custom.remove_hint") }}
                  </p>
                </div>

                <div
                  v-if="installedNodeCount > 0"
                  class="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="space-y-0.5">
                      <p class="text-sm font-medium">
                        {{ $t("pages.plugins.always_load") }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ $t("pages.plugins.always_load_hint") }}
                      </p>
                    </div>
                    <Switch
                      :model-value="alwaysLoad"
                      :disabled="savingAlwaysLoad"
                      @update:model-value="setAlwaysLoad"
                    />
                  </div>

                  <p
                    v-if="alwaysLoad"
                    class="flex items-start gap-1.5 text-xs text-[hsl(var(--tac-amber))]"
                  >
                    <AlertTriangle class="mt-0.5 h-3 w-3 shrink-0" />
                    {{ $t("pages.plugins.always_load_ranked") }}
                  </p>
                </div>

                <!-- Only for a plugin whose catalog entry says it cannot work
                     otherwise. Everything else stays compliant without the
                     operator having to think about it. -->
                <div
                  v-if="plugin.requires_server_guidelines_disabled && isRequested"
                  class="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="space-y-0.5">
                      <p class="text-sm font-medium">
                        {{ $t("pages.plugins.guidelines.toggle") }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{
                          $t("pages.plugins.guidelines.hint", {
                            name: plugin.name,
                          })
                        }}
                      </p>
                    </div>
                    <Switch
                      :model-value="disableGuidelines"
                      :disabled="savingGuidelines"
                      @update:model-value="setDisableGuidelines"
                    />
                  </div>

                  <div
                    class="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2.5 text-xs text-yellow-300"
                    role="alert"
                  >
                    <AlertTriangle class="mt-0.5 h-3 w-3 shrink-0" />
                    <div>
                      <p class="font-medium">
                        {{ $t("pages.plugins.guidelines.warning_title") }}
                      </p>
                      <p class="mt-0.5 text-yellow-300/90">
                        {{ $t("pages.plugins.guidelines.warning_description") }}
                      </p>
                      <a
                        href="https://blog.counter-strike.net/index.php/server_guidelines/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="mt-1 inline-block text-yellow-200 underline hover:text-yellow-100"
                      >
                        {{ $t("pages.plugins.guidelines.warning_link_label") }}
                      </a>
                    </div>
                  </div>

                  <p
                    v-if="!disableGuidelines"
                    class="text-xs text-muted-foreground"
                  >
                    {{ $t("pages.plugins.guidelines.off_hint") }}
                  </p>
                </div>


                <Collapsible v-model:open="showNodes">
                  <!-- A plain button, not the Button component: that centres its
                       content, which is why the chevron used to sit against the
                       label instead of at the far edge. -->
                  <CollapsibleTrigger as-child>
                    <button
                      type="button"
                      class="group flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                    >
                      <span
                        class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        {{ $t("pages.plugins.advanced") }}
                      </span>

                      <span class="flex items-center gap-2">
                        <!-- The count is the whole point of opening it, so it shows
                             without having to. -->
                        <span
                          class="font-mono text-xs"
                          :class="
                            installedNodeCount === nodes.length
                              ? 'text-muted-foreground'
                              : 'text-[hsl(var(--tac-amber))]'
                          "
                        >
                          {{ installedNodeCount }}/{{ nodes.length }}
                        </span>
                        <ChevronDown
                          class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200"
                          :class="showNodes ? 'rotate-180' : ''"
                        />
                      </span>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent class="space-y-2 pt-3">
                    <!-- Per-node rollout, not per-node control: installing states
                         intent for the deployment and each node converges on its own
                         schedule, so this reports where that has got to. -->
                    <div class="divide-y divide-border/60 rounded-md border border-border/60">
                      <div
                        v-for="node in nodes"
                        :key="node.id"
                        class="px-3 py-2"
                      >
                        <div class="flex items-center gap-2">
                          <span
                            class="h-1.5 w-1.5 shrink-0 rounded-full"
                            :class="{
                              'bg-[hsl(var(--tac-amber))]':
                                nodeState(node.id).key === 'Installed',
                              'animate-pulse bg-[hsl(var(--tac-amber)/0.6)]':
                                ['Installing', 'Removing'].includes(
                                  nodeState(node.id).key,
                                ),
                              'bg-muted-foreground/60':
                                nodeState(node.id).key === 'Pending',
                              'bg-destructive':
                                nodeState(node.id).key === 'Failed',
                              'bg-muted-foreground/30':
                                nodeState(node.id).key === 'NotInstalled',
                            }"
                          ></span>

                          <p class="min-w-0 flex-1 truncate text-sm">
                            {{ node.label ?? node.id }}
                          </p>

                          <span
                            class="shrink-0 font-mono text-xs"
                            :class="{
                              'text-muted-foreground':
                                nodeState(node.id).key === 'Installed',
                              'text-[hsl(var(--tac-amber))]':
                                ['Installing', 'Removing'].includes(
                                  nodeState(node.id).key,
                                ),
                              'text-destructive':
                                nodeState(node.id).key === 'Failed',
                              'text-muted-foreground/50': [
                                'Pending',
                                'NotInstalled',
                              ].includes(nodeState(node.id).key),
                            }"
                          >
                            {{ nodeState(node.id).label }}
                          </span>

                          <!-- Configs are written per node on the node's own
                               volume, so this belongs on the node it opens,
                               rather than in a card that had to pick one. -->
                          <Button
                            v-if="nodeState(node.id).key === 'Installed'"
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 shrink-0 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                            :title="$t('pages.plugins.configure_open')"
                            :aria-label="$t('pages.plugins.configure_open')"
                            @click="openConfigFiles(node.id)"
                          >
                            <FolderOpen class="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <p
                          v-if="nodeState(node.id).error"
                          class="mt-1 break-words pl-3.5 font-mono text-[0.7rem] text-destructive/90"
                        >
                          {{ nodeState(node.id).error }}
                        </p>

                        <!-- Without this a node that stopped reporting looks
                             identical to one that is up to date. -->
                        <p
                          class="mt-0.5 pl-3.5 text-[0.7rem] text-muted-foreground/70"
                        >
                          <template v-if="node.plugins_synced_at">
                            {{ $t("pages.plugins.checked") }}
                            <TimeAgo
                              :date="node.plugins_synced_at"
                              hide-icon
                              class="text-[0.7rem]"
                            />
                          </template>
                          <template v-else>
                            {{ $t("pages.plugins.never_checked") }}
                          </template>
                        </p>
                      </div>
                    </div>

                    <p class="text-xs text-muted-foreground">
                      {{ $t("pages.plugins.advanced_hint") }}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </template>
            </CardContent>
          </Card>

          <section v-if="pairedPlugins.length > 0" class="space-y-3">
            <h2
              class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("pages.plugins.pairs_with") }}
            </h2>

            <!-- A pairing is the other half of a working setup, so it gets a real
                 target rather than a badge that happened to be wrapped in a link. -->
            <NuxtLink
              v-for="paired in pairedPlugins"
              :key="paired.slug"
              :to="`/plugins/${paired.slug}`"
              class="group flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 transition-all duration-200 hover:border-[hsl(var(--tac-amber)/0.45)] hover:bg-[hsl(var(--tac-amber)/0.04)]"
            >
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors group-hover:border-[hsl(var(--tac-amber)/0.4)] group-hover:text-[hsl(var(--tac-amber))]"
              >
                <component :is="kindIcon(paired.kind)" class="h-4 w-4" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium">{{ paired.name }}</span>
                </div>
                <p class="line-clamp-2 text-xs text-muted-foreground">
                  {{ paired.description }}
                </p>
              </div>

              <ArrowRight
                class="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[hsl(var(--tac-amber))]"
              />
            </NuxtLink>
          </section>

          <div
            v-if="plugin.requires_service"
            class="flex items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground"
          >
            <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {{
                $t("pages.plugins.requires_service", {
                  service: plugin.requires_service,
                })
              }}
            </span>
          </div>

              <Card v-if="versions.length > 0">
                <CardHeader>
                  <CardTitle class="text-base">
                {{ $t("pages.plugins.releases") }}
              </CardTitle>
            </CardHeader>
                <CardContent>
              <div
                v-for="version in latestVersions"
                :key="`${version.runtime}-${version.version}`"
                class="flex items-center justify-between gap-4 border-b py-2 last:border-0"
              >
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm">{{ version.version }}</span>
                  <Badge variant="outline" class="text-[0.65rem]">
                    {{
                      version.runtime === "swiftlys2"
                        ? "SwiftlyS2"
                        : "CounterStrikeSharp"
                    }}
                  </Badge>
                </div>
                <span class="text-xs text-muted-foreground">
                  {{ new Date(version.published_at).toLocaleDateString() }}
                </span>
              </div>
            </CardContent>
              </Card>
        </aside>
      </div>
    <AlertDialog v-model:open="confirmRemove">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("pages.plugins.remove_confirm_title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{
              $t("pages.plugins.remove_confirm_description", {
                modes: modesUsing.map((mode) => mode.name).join(", "),
              })
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="removePlugin(true)"
          >
            {{ $t("pages.plugins.remove_confirm_action") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useFilePopout } from "~/composables/useFilePopout";
import { pluginAuthorUrl } from "~/utilities/pluginAuthor";
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

const ALL_NODES = "__all__";

export default {
  data() {
    return {
      busy: null as string | null,
      showNodes: false,
      ALL_NODES,
      plugin: null as Record<string, any> | null,
      nodes: [] as Array<Record<string, any>>,
      paired: [] as Array<Record<string, any>>,
      readmeRuntime: "",
      readmeLoading: false,
      // Keyed by runtime so flipping back to a tab already read is instant
      // rather than a second round trip to GitHub.
      readmes: {} as Record<string, Record<string, any> | null>,
      alwaysLoad: false,
      savingAlwaysLoad: false,
      disableGuidelines: false,
      savingGuidelines: false,
      removingFromCatalog: false,
      confirmRemove: false,
      modePlugins: [] as Array<Record<string, any>>,
      installedPages: [] as Array<Record<string, any>>,
      desired: [] as Array<Record<string, any>>,
      installs: [] as Array<Record<string, any>>,
    };
  },
  apollo: {
    $subscribe: {
      // Install is a request, not an act: the node converges on its own and
      // reports back. Polling it with refetch() only ever showed the state at
      // the moment you happened to ask.
      desired: {
        query: typedGql("subscription")({
          game_plugin_installs: [
            {},
            {
              plugin_slug: true,
              always_load: true,
              disable_server_guidelines: true,
              version: true,
              channel: true,
            },
          ],
        }),
        result: function ({ data }: { data: Record<string, any> }) {
          this.desired = data?.game_plugin_installs ?? [];
        },
        skip() {
          return !this.isAdministrator;
        },
      },
      nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {},
            {
              id: true,
              label: true,
              status: true,
              plugins_synced_at: true,
            },
          ],
        }),
        result: function ({ data }: { data: Record<string, any> }) {
          this.nodes = data?.game_server_nodes ?? [];
        },
        skip() {
          return !this.isAdministrator;
        },
      },
      modePlugins: {
        query: typedGql("subscription")({
          game_mode_plugins: [
            {},
            {
              plugin_slug: true,
              game_mode: { id: true, name: true, archived_at: true },
            },
          ],
        }),
        result: function ({ data }: { data: Record<string, any> }) {
          this.modePlugins = data?.game_mode_plugins ?? [];
        },
        skip() {
          return !this.isAdministrator;
        },
      },
      installs: {
        query: typedGql("subscription")({
          game_server_node_plugins: [
            {},
            {
              game_server_node_id: true,
              plugin_slug: true,
              version: true,
              status: true,
              detected: true,
              last_error: true,
              updated_at: true,
            },
          ],
        }),
        result: function ({ data }: { data: Record<string, any> }) {
          this.installs = data?.game_server_node_plugins ?? [];
        },
        skip() {
          return !this.isAdministrator;
        },
      },
    },
    plugin: {
      query: typedGql("query")({
        game_plugins_by_pk: [
          { slug: $("slug", "String!") },
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
            hot_swappable: true,
            requires_service: true,
            requires_server_guidelines_disabled: true,
            panel: true,
            pairs_with: true,
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
      variables() {
        return { slug: this.$route.params.slug };
      },
      update(data: { game_plugins_by_pk: Record<string, any> }) {
        return data.game_plugins_by_pk;
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
    paired: {
      query: typedGql("query")({
        game_plugins: [
          {},
          { slug: true, name: true, kind: true, description: true },
        ],
      }),
      update(data: { game_plugins: Array<Record<string, any>> }) {
        return data.game_plugins;
      },
    },
  },
  watch: {
    readmeVariants: {
      immediate: true,
      handler(variants: Array<Record<string, any>>) {
        if (variants.length === 0) {
          return;
        }

        if (!variants.some((variant) => variant.key === this.readmeRuntime)) {
          this.readmeRuntime = variants[0].key;
        }
      },
    },
    readmeRuntime: {
      immediate: true,
      handler() {
        void this.loadReadme();
      },
    },
    "plugin.slug": {
      immediate: true,
      handler() {
        this.readmes = {};
        void this.loadReadme();
      },
    },
    desired: {
      immediate: true,
      handler(rows: Array<Record<string, any>>) {
        const row = (rows ?? []).find(
          (entry) => entry.plugin_slug === this.$route.params.slug,
        );
        this.alwaysLoad = Boolean(row?.always_load);
        this.disableGuidelines = Boolean(row?.disable_server_guidelines);
      },
    },
  },
  methods: {
    openConfigFiles(nodeId: string) {
      useFilePopout().openFiles({
        scope: "node",
        id: nodeId,
        path: `addons/${this.runtime}/configs/plugins`,
      });
    },
    labelForRuntime(runtime: string) {
      return runtime === "swiftlys2" ? "SwiftlyS2" : "CounterStrikeSharp";
    },
    async loadReadme() {
      const slug = this.plugin?.slug;
      const runtime = this.readmeRuntime;

      if (!slug || runtime in this.readmes) {
        return;
      }

      this.readmeLoading = true;

      try {
        const { data } = await (this as any).$apollo.mutate({
          mutation: generateMutation({
            getPluginReadme: [
              runtime ? { slug, runtime } : { slug },
              { content: true, format: true, url: true, repo: true },
            ],
          }),
        });

        const result = data?.getPluginReadme;

        this.readmes = {
          ...this.readmes,
          [runtime]: result?.content ? result : null,
        };
      } catch {
        // A missing README is not worth an error state; the rest of the page
        // still tells you what you need to install it.
        this.readmes = { ...this.readmes, [runtime]: null };
      } finally {
        this.readmeLoading = false;
      }
    },
    async setAlwaysLoad(value: boolean) {
      this.savingAlwaysLoad = true;
      this.alwaysLoad = value;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_game_plugin_installs_by_pk: [
              {
                pk_columns: { plugin_slug: this.$route.params.slug as string },
                _set: { always_load: value },
              },
              { plugin_slug: true },
            ],
          }),
        });
      } catch (error) {
        this.alwaysLoad = !value;
        toast({ title: (error as Error).message, variant: "destructive" });
      } finally {
        this.savingAlwaysLoad = false;
      }
    },
    async removeFromCatalog() {
      if (this.removingFromCatalog) {
        return;
      }

      this.removingFromCatalog = true;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            delete_game_plugins_by_pk: [
              { slug: this.$route.params.slug as string },
              { slug: true },
            ],
          }),
        });

        toast({ title: this.$t("pages.plugins.custom.removed") as string });
        void this.$router.push("/plugins");
      } catch (error) {
        toast({ title: (error as Error).message, variant: "destructive" });
      } finally {
        this.removingFromCatalog = false;
      }
    },
    async setDisableGuidelines(value: boolean) {
      this.savingGuidelines = true;
      this.disableGuidelines = value;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_game_plugin_installs_by_pk: [
              {
                pk_columns: { plugin_slug: this.$route.params.slug as string },
                _set: { disable_server_guidelines: value },
              },
              { plugin_slug: true },
            ],
          }),
        });
      } catch (error) {
        this.disableGuidelines = !value;
        toast({ title: (error as Error).message, variant: "destructive" });
      } finally {
        this.savingGuidelines = false;
      }
    },
    kindIcon(kind: string) {
      if (kind === "panel") {
        return LayoutDashboard;
      }

      return kind === "bundle" ? Package : Puzzle;
    },
    // Reports the status the node recorded, rather than deriving one. The
    // derived version claimed "Installing" for a node that had not been told
    // about the plugin yet, which is a different thing from one that is
    // actually downloading it.
    nodeState(nodeId: string) {
      const install = this.installs.find(
        (entry) =>
          entry.game_server_node_id === nodeId &&
          entry.plugin_slug === this.$route.params.slug,
      );

      if (!install) {
        // No row is not the same as not wanted. If the plugin is requested,
        // this node owes us an install and has not reported one -- which is
        // what Pending means. Rows only appear once a node is asked or reports.
        if (this.isRequested) {
          return {
            key: "Pending",
            label: this.$t("pages.plugins.status.Pending"),
            error: null,
          };
        }

        return {
          key: "NotInstalled",
          label: this.$t("pages.plugins.state_absent"),
          error: null,
        };
      }

      // Present on disk is the one fact worth preferring over the recorded
      // status, because it is observed rather than reported.
      if (install.detected && install.status === "Installed") {
        return {
          key: "Installed",
          label: install.version ?? this.$t("pages.plugins.state_installed"),
          error: null,
        };
      }

      return {
        key: install.status,
        label: this.$t(`pages.plugins.status.${install.status}`),
        error: install.last_error ?? null,
      };
    },
    installedOn(nodeId: string) {
      const install = this.installs.find(
        (entry) =>
          entry.game_server_node_id === nodeId &&
          entry.plugin_slug === this.$route.params.slug,
      );

      return install?.version ?? null;
    },
    async install() {
      await this.run(this.ALL_NODES, () =>
        (this as any).$apollo.mutate({
          mutation: generateMutation({
            installGamePlugin: [
              { slug: this.$route.params.slug as string },
              { success: true },
            ],
          }),
        }),
      );
    },
    async uninstall() {
      if (this.modesUsing.length > 0) {
        this.confirmRemove = true;
        return;
      }

      await this.removePlugin(false);
    },
    async removePlugin(force: boolean) {
      this.confirmRemove = false;

      await this.run(this.ALL_NODES, () =>
        (this as any).$apollo.mutate({
          mutation: generateMutation({
            uninstallGamePlugin: [
              { slug: this.$route.params.slug as string, force },
              { success: true },
            ],
          }),
        }),
      );
    },
    async run(nodeId: string, action: () => Promise<unknown>) {
      if (this.busy) {
        return;
      }

      this.busy = nodeId;

      try {
        // Recording intent is all this can fail at. Whether each node converged
        // is not known yet and is not knowable here: it arrives on the installs
        // subscription, which is what the per-node states below render.
        await action();

        toast({ title: this.$t("pages.plugins.install_success") as string });
      } catch (error) {
        toast({
          title: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        this.busy = null;
      }
    },
  },
  computed: {
    isAdministrator() {
      return useAuthStore().isRoleAbove("administrator");
    },
    // Matched on the /apps/<slug> route the plugin's own manifest claims: the
    // URL an operator registered is their own hosting and matches nothing here.
    installedPage(): Record<string, any> | null {
      const routeSlug = this.plugin?.panel?.slug;

      return (
        this.installedPages.find(
          (page) =>
            page.plugin_slug === this.plugin?.slug ||
            (routeSlug && page.slug === routeSlug),
        ) ?? null
      );
    },
    pairedPlugins(): Array<Record<string, any>> {
      const slugs: Array<string> = this.plugin?.pairs_with ?? [];

      return slugs
        .map((slug) => this.paired.find((entry) => entry.slug === slug))
        .filter(Boolean) as Array<Record<string, any>>;
    },
    authorUrl(): string | null {
      return this.plugin ? pluginAuthorUrl(this.plugin) : null;
    },
    isPanelPlugin(): boolean {
      return ["panel", "bundle"].includes(this.plugin?.kind);
    },
    panelInstallCommand(): string {
      const repo = this.plugin?.panel?.repo;
      const command = this.plugin?.panel?.install_command;

      return command ?? `./plugin.sh ${repo ?? this.plugin?.homepage ?? ""}`;
    },
    runtime() {
      return useApplicationSettingsStore().gameServerPluginRuntime;
    },
    runtimeLabel() {
      return this.labelForRuntime(this.runtime);
    },
    // One tab per framework the plugin actually ships a build for, this
    // deployment's runtime first so the default tab is the one whose README
    // describes what you would actually install.
    readmeVariants(): Array<Record<string, any>> {
      const present = new Set(
        this.versions.map((version: Record<string, any>) => version.runtime),
      );

      return ["swiftlys2", "counterstrikesharp"]
        .sort((a, b) => Number(b === this.runtime) - Number(a === this.runtime))
        .filter((runtime) => present.has(runtime))
        .map((runtime) => ({
          key: runtime,
          label: this.labelForRuntime(runtime),
        }));
    },
    readme(): string | null {
      return this.readmes[this.readmeRuntime]?.content ?? null;
    },
    readmeFormat(): string | null {
      return this.readmes[this.readmeRuntime]?.format ?? null;
    },
    readmeRepo(): string | null {
      return this.readmes[this.readmeRuntime]?.repo ?? null;
    },
    readmeLoaded(): boolean {
      return this.readmeRuntime in this.readmes;
    },
    versions(): Array<Record<string, any>> {
      return this.plugin?.versions ?? [];
    },
    // One row per runtime. The catalog keeps the full history because the
    // update check needs something to compare against, but a reader only wants
    // to know what they would get.
    latestVersions(): Array<Record<string, any>> {
      const seen = new Set<string>();

      return this.versions.filter((version) => {
        if (seen.has(version.runtime)) {
          return false;
        }

        seen.add(version.runtime);
        return true;
      });
    },

    modesUsing(): Array<Record<string, any>> {
      return this.modePlugins
        .filter(
          (entry: Record<string, any>) =>
            entry.plugin_slug === this.$route.params.slug &&
            entry.game_mode &&
            !entry.game_mode.archived_at,
        )
        .map((entry: Record<string, any>) => entry.game_mode);
    },
    canRemoveFromCatalog(): boolean {
      return (
        this.plugin?.source === "custom" &&
        !this.isRequested &&
        this.installedNodeCount === 0
      );
    },
    isRequested(): boolean {
      return this.desired.some(
        (entry: Record<string, any>) =>
          entry.plugin_slug === this.$route.params.slug,
      );
    },
    installedNodeCount(): number {
      return this.nodes.filter((node) => this.installedOn(node.id)).length;
    },
    // A plugin with no release for the runtime this deployment runs cannot be
    // installed here at all, so the node list is replaced with the reason.
    availableForRuntime() {
      return this.versions.some(
        (version) => version.runtime === this.runtime,
      );
    },
  },
};
</script>
