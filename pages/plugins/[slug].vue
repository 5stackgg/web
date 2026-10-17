<script setup lang="ts">
import { Button } from "~/components/ui/button";
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
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import SlideSwap from "~/components/ui/transitions/SlideSwap.vue";
import PluginReadme from "~/components/game-plugins/PluginReadme.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import {
  nodeRolloutTextClass,
  nodeRolloutTone,
} from "~/components/plugins/pluginDirectoryState";
import { Switch } from "~/components/ui/switch";
import {
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpCircle,
  Ban,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Settings2,
  FolderOpen,
  Download,
  Hand,
  LayoutDashboard,
  Package,
  Puzzle,
  Wrench,
  RefreshCw,
  Pencil,
} from "lucide-vue-next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { dateLocale } from "~/utilities/dateLocale";
import {
  createButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({
  middleware: "admin",
});

const railSection =
  "grid gap-3 border-t border-border/60 py-4 first:border-t-0 first:pt-0";
const sectionLabel = [tacticalSectionLabelClasses, "mb-0"];
const settingRow =
  "flex items-start justify-between gap-4 border-b border-border/40 py-3 last:border-b-0";
const goldButton = [createButtonClasses, "w-full"];
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-6" v-if="plugin">
      <Button
        as-child
        variant="ghost"
        size="sm"
        class="-ml-2 h-8 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <NuxtLink to="/plugins">
          <ArrowLeft class="h-4 w-4" />
          {{ $t("pages.plugins.back") }}
        </NuxtLink>
      </Button>

      <div class="flex flex-wrap items-start gap-3.5">
        <span
          class="grid size-[52px] shrink-0 place-items-center rounded-[10px] border border-border bg-[hsl(240_5%_9%)] text-muted-foreground"
        >
          <component :is="kindIcon(plugin.kind)" class="size-[22px]" />
        </span>

        <div class="grid min-w-[min(100%,260px)] flex-1 gap-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold leading-tight tracking-tight">
              {{ plugin.name }}
            </h1>
            <FiveStackToolTip v-if="plugin.verified" as-child>
              <template #trigger>
                <span
                  tabindex="0"
                  role="img"
                  class="inline-flex text-success"
                  :aria-label="$t('pages.plugins.verified')"
                >
                  <ShieldCheck class="h-4 w-4" />
                </span>
              </template>
              {{ $t("pages.plugins.store.verified_hint") }}
            </FiveStackToolTip>
            <FiveStackToolTip v-if="plugin.source === 'custom'" as-child>
              <template #trigger>
                <span
                  tabindex="0"
                  class="inline-flex h-5 items-center gap-1 rounded-md border border-border px-1.5 text-[0.7rem] text-muted-foreground"
                >
                  <Wrench class="h-3 w-3" />
                  {{ $t("pages.plugins.custom.badge") }}
                </span>
              </template>
              {{ $t("pages.plugins.store.custom_hint") }}
            </FiveStackToolTip>
            <!-- Worth knowing before installing, not only once the toggle is
                 in front of you. -->
            <FiveStackToolTip
              v-if="plugin.requires_server_guidelines_disabled"
              as-child
            >
              <template #trigger>
                <span
                  tabindex="0"
                  class="inline-flex h-5 items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 text-[0.7rem] text-warning"
                >
                  <AlertTriangle class="h-3 w-3" />
                  {{ $t("pages.plugins.guidelines.badge") }}
                </span>
              </template>
              {{ $t("pages.plugins.store.guidelines_hint") }}
            </FiveStackToolTip>
          </div>

          <p class="text-xs text-muted-foreground">
            <a
              v-if="repoUrl"
              :href="repoUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {{ $t("pages.plugins.by", { author: plugin.author }) }}
            </a>
            <template v-else>
              {{ $t("pages.plugins.by", { author: plugin.author }) }}
            </template>
            <span aria-hidden="true"> · </span>
            {{ $t(`pages.plugins.detail.kind_${plugin.kind}`) }}
          </p>

          <div class="flex flex-wrap gap-1">
            <span
              v-for="variant in readmeVariants"
              :key="variant.key"
              class="inline-flex h-5 items-center rounded-md bg-muted/60 px-1.5 text-[0.68rem] text-foreground/80"
            >
              {{ variant.label }}
            </span>
            <span
              v-for="tag in (plugin.tags ?? []).slice(0, 8)"
              :key="tag"
              class="inline-flex h-5 items-center rounded-md border border-border/60 px-1.5 text-[0.68rem] text-muted-foreground"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <Button
          v-if="plugin.homepage"
          as-child
          variant="outline"
          size="sm"
          class="h-8 gap-2"
        >
          <a :href="plugin.homepage" target="_blank" rel="noopener noreferrer">
            <ExternalLink class="h-3.5 w-3.5" />
            {{ $t("pages.plugins.source") }}
          </a>
        </Button>
      </div>

      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        <div class="min-w-0 space-y-4">
          <p class="text-muted-foreground">{{ plugin.description }}</p>

          <!-- A plugin built for both frameworks is two repositories with two
               READMEs. Showing only the homepage's one silently hides half the
               documentation, so each variant gets a tab. -->
          <div
            v-if="readmeVariants.length > 1"
            class="flex flex-wrap items-center gap-3"
          >
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

          <SlideSwap :index="readmeIndex">
            <div :key="readmeRuntime || 'readme'">
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
          </SlideSwap>
        </div>

        <aside class="grid lg:sticky lg:top-6">
          <!-- The install box keeps its frame: it is the one thing on the page
               that says what this plugin is doing on this deployment. -->
          <section :class="railSection">
            <div
              class="grid gap-2.5 rounded-lg border border-border bg-card/40 p-3.5"
            >
              <!-- A panel plugin is installed on the machine hosting the
                   panel, not onto a game node, so it gets its own treatment
                   rather than a node list. -->
              <template v-if="isPanelPlugin && installedPage">
                <div :class="sectionLabel">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("pages.plugins.live_title") }}
                </div>
                <p
                  class="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <Check class="h-4 w-4 shrink-0" :class="TONE_TEXT.ok" />
                  {{ $t("pages.plugins.already_installed") }}
                </p>
                <div class="flex items-center gap-2">
                  <Button as-child size="sm" :class="[goldButton, 'flex-1']">
                    <NuxtLink :to="`/apps/${installedPage.slug}`">
                      {{ $t("pages.plugins.open_plugin") }}
                      <ArrowRight class="h-4 w-4" />
                    </NuxtLink>
                  </Button>
                  <!-- Icon only, so the row stays one line in the rail. -->
                  <Button
                    as-child
                    variant="outline"
                    size="icon-sm"
                    :aria-label="$t('pages.plugins.manage')"
                    :title="$t('pages.plugins.manage')"
                  >
                    <NuxtLink to="/settings/application/plugins">
                      <Settings2 class="h-4 w-4" />
                    </NuxtLink>
                  </Button>
                </div>
              </template>

              <template v-else-if="isPanelPlugin">
                <div :class="sectionLabel">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("pages.plugins.panel_install_title") }}
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ $t("pages.plugins.panel_install_hint") }}
                </p>

                <ol class="grid gap-3.5">
                  <li
                    class="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 text-sm"
                  >
                    <span
                      class="grid size-[22px] place-items-center rounded-full border border-border font-mono text-[0.68rem] text-muted-foreground"
                      >1</span
                    >
                    <div class="min-w-0">
                      {{ $t("pages.plugins.panel_step_deploy") }}
                      <div
                        class="mt-1.5 flex min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-background/60 py-1.5 pl-2.5 pr-1.5 font-mono text-xs"
                      >
                        <code
                          class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap"
                          >{{ panelInstallCommand }}</code
                        >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          class="size-6 shrink-0 text-muted-foreground"
                          :aria-label="$t('pages.plugins.detail.copy_command')"
                          :title="$t('pages.plugins.detail.copy_command')"
                          @click="copyCommand"
                        >
                          <Copy class="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                  <li
                    class="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 text-sm"
                  >
                    <span
                      class="grid size-[22px] place-items-center rounded-full border border-border font-mono text-[0.68rem] text-muted-foreground"
                      >2</span
                    >
                    <p>{{ $t("pages.plugins.panel_step_dns") }}</p>
                  </li>
                  <li
                    class="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 text-sm"
                  >
                    <span
                      class="grid size-[22px] place-items-center rounded-full border border-border font-mono text-[0.68rem] text-muted-foreground"
                      >3</span
                    >
                    <p>{{ $t("pages.plugins.panel_step_register") }}</p>
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
              </template>

              <template v-if="isAdministrator && plugin.kind !== 'panel'">
                <div
                  v-if="plugin.kind === 'bundle'"
                  class="my-1 h-px bg-border/60"
                  aria-hidden="true"
                />

                <p
                  v-if="!availableForRuntime"
                  class="flex items-start gap-1.5 text-sm text-muted-foreground"
                >
                  <Ban class="mt-0.5 h-4 w-4 shrink-0" />
                  {{
                    $t("pages.plugins.unavailable_for_runtime", {
                      runtime: runtimeLabel,
                    })
                  }}
                </p>

                <p
                  v-else-if="nodes.length === 0"
                  class="text-sm text-muted-foreground"
                >
                  {{ $t("pages.plugins.no_nodes") }}
                </p>

                <template v-else>
                  <!-- Install records intent, and the nodes converge to it on
                       their own, so this reports where the rollout has got to
                       instead of a button that has nothing left to do. -->
                  <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span
                      v-if="rollout.key === 'Failed'"
                      class="inline-flex items-center gap-1.5 text-sm text-destructive"
                    >
                      <CircleAlert class="h-4 w-4" />
                      <template v-if="failedNodeLabels.length === 1">
                        {{
                          $t("pages.plugins.store.failed_on", {
                            node: failedNodeLabels[0],
                          })
                        }}
                      </template>
                      <template v-else>
                        {{
                          $t(
                            "pages.plugins.store.failed_on_nodes",
                            { count: failedNodeLabels.length },
                            failedNodeLabels.length,
                          )
                        }}
                      </template>
                    </span>
                    <span
                      v-else-if="isRequested && rollout.key === 'Installed'"
                      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                    >
                      <Check class="h-4 w-4" :class="TONE_TEXT.ok" />
                      {{ $t("pages.plugins.status.Installed") }}
                    </span>
                    <span
                      v-else-if="isRequested"
                      class="inline-flex items-center gap-1.5 text-sm tabular-nums text-[hsl(var(--tac-amber))]"
                    >
                      <Download class="h-4 w-4" />
                      {{
                        $t("pages.plugins.store.installing_on", {
                          installed: installedNodeCount,
                          total: nodes.length,
                        })
                      }}
                    </span>
                    <FiveStackToolTip v-else-if="isManual" as-child>
                      <template #trigger>
                        <span
                          tabindex="0"
                          class="inline-flex items-center gap-1.5 text-sm"
                          :class="TONE_TEXT.warn"
                        >
                          <Hand class="h-4 w-4" />
                          {{ $t("pages.plugins.store.found_on_disk") }}
                        </span>
                      </template>
                      {{ $t("pages.plugins.store.found_on_disk_hint") }}
                    </FiveStackToolTip>

                    <span
                      v-if="
                        isRequested &&
                        ['Installed', 'Failed'].includes(rollout.key)
                      "
                      class="text-xs tabular-nums text-muted-foreground"
                    >
                      {{
                        $t("pages.plugins.installed_on", {
                          installed: installedNodeCount,
                          total: nodes.length,
                        })
                      }}
                    </span>
                    <span
                      v-else-if="isManual"
                      class="text-xs text-muted-foreground"
                    >
                      {{
                        $t("pages.plugins.detail.manual_on", {
                          nodes: manualNodeLabels.join(", "),
                        })
                      }}
                    </span>
                    <span
                      v-else-if="!isRequested && latestForRuntime"
                      class="text-xs text-muted-foreground"
                    >
                      {{
                        $t("pages.plugins.detail.latest_for", {
                          version: latestForRuntime,
                          runtime: runtimeLabel,
                        })
                      }}
                    </span>
                  </div>

                  <div
                    v-if="isRequested"
                    class="h-1 overflow-hidden rounded-full bg-muted/60"
                  >
                    <div
                      class="h-full origin-left rounded-full motion-reduce:!transition-none"
                      :class="
                        rollout.key === 'Failed'
                          ? 'bg-destructive'
                          : rollout.key === 'Installed'
                            ? 'bg-success'
                            : 'bg-[hsl(var(--tac-amber))]'
                      "
                      :style="{
                        transform: `scaleX(${nodes.length ? installedNodeCount / nodes.length : 0})`,
                        transition:
                          'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }"
                    />
                  </div>

                  <Button
                    v-if="!isRequested"
                    size="sm"
                    :class="goldButton"
                    :loading="busy === ALL_NODES"
                    @click="install()"
                  >
                    <Download class="h-4 w-4" />
                    {{
                      isManual
                        ? $t("pages.plugins.store.manage_here")
                        : $t("pages.plugins.install")
                    }}
                  </Button>
                  <!-- A failed node is the one case where pressing something
                       again is the right move: it re-seeds the request and
                       nudges the node to try the download once more. -->
                  <Button
                    v-else-if="rollout.key === 'Failed'"
                    size="sm"
                    :class="goldButton"
                    :loading="busy === ALL_NODES"
                    @click="retry()"
                  >
                    <RefreshCw class="h-4 w-4" />
                    {{ $t("pages.plugins.retry") }}
                  </Button>
                  <Button
                    v-else-if="updateVersion"
                    size="sm"
                    :class="goldButton"
                    :loading="busy === ALL_NODES"
                    @click="install(updateVersion)"
                  >
                    <ArrowUpCircle class="h-4 w-4" />
                    {{
                      $t("pages.plugins.store.update_to", {
                        version: updateVersion,
                      })
                    }}
                  </Button>
                  <p v-if="!isRequested" class="text-xs text-muted-foreground">
                    {{
                      $t("pages.plugins.installs_everywhere", {
                        count: onlineNodeCount,
                      })
                    }}
                  </p>

                  <template v-if="isRequested || isManual">
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      :aria-expanded="showNodes"
                      @click="showNodes = !showNodes"
                    >
                      <span>{{ $t("pages.plugins.advanced") }}</span>
                      <span class="flex items-center gap-1.5">
                        <!-- The count is the whole point of opening it, so it
                             shows without having to. -->
                        <span
                          class="font-mono tabular-nums"
                          :class="
                            installedNodeCount === nodes.length
                              ? ''
                              : 'text-[hsl(var(--tac-amber))]'
                          "
                        >
                          {{ installedNodeCount }}/{{ nodes.length }}
                        </span>
                        <ChevronDown
                          class="h-3.5 w-3.5 transition-transform duration-200"
                          :class="showNodes ? 'rotate-180' : ''"
                        />
                      </span>
                    </button>

                    <Fold :open="showNodes">
                      <div class="grid gap-2 pt-0.5">
                        <!-- Per-node rollout, not per-node control: each node
                             converges on its own schedule, so this reports
                             where that has got to. -->
                        <div
                          class="divide-y divide-border/40 rounded-md border border-border/60"
                        >
                          <div
                            v-for="node in nodes"
                            :key="node.id"
                            class="px-3 py-2"
                          >
                            <div class="flex items-center gap-2">
                              <!-- Pings only while the node is installing or
                                   removing right now. -->
                              <StatusDot
                                size="sm"
                                :tone="nodeRolloutTone(nodeState(node.id).key)"
                                :live="
                                  ['Installing', 'Removing'].includes(
                                    nodeState(node.id).key,
                                  )
                                "
                              />

                              <p
                                class="min-w-0 flex-1 truncate text-sm"
                                :title="node.label ?? node.id"
                              >
                                {{ node.label ?? node.id }}
                                <span
                                  v-if="node.status === 'Offline'"
                                  class="text-xs text-muted-foreground"
                                >
                                  ·
                                  {{ $t("pages.plugins.detail.node_offline") }}
                                </span>
                                <span
                                  v-else-if="
                                    node.status === 'NotAcceptingNewMatches'
                                  "
                                  class="text-xs text-muted-foreground"
                                >
                                  ·
                                  {{
                                    $t(
                                      "pages.plugins.detail.node_not_accepting",
                                    )
                                  }}
                                </span>
                              </p>

                              <span
                                class="shrink-0 font-mono text-xs"
                                :class="
                                  nodeRolloutTextClass(nodeState(node.id).key)
                                "
                              >
                                {{ nodeState(node.id).label }}
                              </span>

                              <!-- Configs are written per node on the node's
                                   own volume, so this belongs on the node it
                                   opens. -->
                              <Button
                                v-if="
                                  ['Installed', 'Manual'].includes(
                                    nodeState(node.id).key,
                                  )
                                "
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

                            <!-- Without this a node that stopped reporting
                                 looks identical to one that is up to date. -->
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
                      </div>
                    </Fold>
                  </template>
                </template>

                <div
                  v-if="isRequested || plugin.source === 'custom'"
                  class="flex flex-wrap items-center gap-2 pt-0.5"
                >
                  <Button
                    v-if="isRequested"
                    variant="outline"
                    size="sm"
                    class="h-7 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    :loading="busy === ALL_NODES"
                    @click="uninstall()"
                  >
                    {{ $t("pages.plugins.uninstall") }}
                  </Button>

                  <!-- Only an entry this deployment authored can be taken out
                       of the catalog; a registry one would come back on the
                       next sync. Removal waits until nothing is installed, so
                       the files are gone from the nodes before the entry that
                       describes them is. -->
                  <Button
                    v-if="canRemoveFromCatalog"
                    variant="ghost"
                    size="sm"
                    class="h-7 text-destructive hover:text-destructive"
                    :loading="removingFromCatalog"
                    @click="removeFromCatalog()"
                  >
                    {{ $t("pages.plugins.custom.remove") }}
                  </Button>
                  <p
                    v-else-if="plugin.source === 'custom'"
                    class="text-xs text-muted-foreground"
                  >
                    {{ $t("pages.plugins.custom.remove_hint") }}
                  </p>
                </div>
              </template>
            </div>
          </section>

          <section
            v-if="isAdministrator && isRequested && plugin.kind !== 'panel'"
            :class="railSection"
          >
            <div :class="sectionLabel">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.plugins.detail.rollout_settings") }}
            </div>

            <div>
              <!-- Installing tracks the newest release, so the version
                   running on every node can change with nobody asking for
                   it. Turning this off freezes the fleet where it is. -->
              <div :class="settingRow">
                <div class="space-y-0.5">
                  <p class="text-sm">
                    {{ $t("pages.plugins.auto_update.toggle") }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{
                      !autoUpdate && pinnedVersion
                        ? $t("pages.plugins.auto_update.pinned", {
                            version: pinnedVersion,
                          })
                        : $t("pages.plugins.auto_update.hint")
                    }}
                  </p>
                </div>
                <Switch
                  :model-value="autoUpdate"
                  :disabled="savingAutoUpdate"
                  :aria-label="$t('pages.plugins.auto_update.toggle')"
                  @update:model-value="setAutoUpdate"
                />
              </div>

              <PluginLoadTargets
                :targets="loadTargets"
                :disabled="savingLoadTargets"
                @update="setLoadTarget"
              />

              <!-- Only for a plugin whose catalog entry says it cannot work
                   otherwise. 5stack Ranks turns the same setting off to render
                   ranks in-game, and once that is on there is nothing left to
                   decide here, so the switch gives way to the fact. -->
              <div
                v-if="
                  plugin.requires_server_guidelines_disabled &&
                  guidelinesOffForRanks
                "
                :class="settingRow"
              >
                <p class="text-xs text-muted-foreground">
                  {{ $t("pages.plugins.guidelines.already_off") }}
                  <NuxtLink
                    to="/settings/application/matchmaking#ranks"
                    class="underline underline-offset-2 hover:text-foreground"
                  >
                    {{ $t("pages.plugins.guidelines.already_off_link") }}
                  </NuxtLink>
                </p>
              </div>

              <div
                v-else-if="plugin.requires_server_guidelines_disabled"
                class="grid gap-2 py-3"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="space-y-0.5">
                    <p class="text-sm">
                      {{ $t("pages.plugins.guidelines.toggle") }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{
                        disableGuidelines
                          ? $t("pages.plugins.guidelines.hint", {
                              name: plugin.name,
                            })
                          : $t("pages.plugins.guidelines.off_hint")
                      }}
                    </p>
                  </div>
                  <Switch
                    :model-value="disableGuidelines"
                    :disabled="savingGuidelines"
                    :aria-label="$t('pages.plugins.guidelines.toggle')"
                    @update:model-value="setDisableGuidelines"
                  />
                </div>

                <div
                  class="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning"
                  role="alert"
                >
                  <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <p class="font-medium">
                      {{ $t("pages.plugins.guidelines.warning_title") }}
                    </p>
                    <p class="mt-0.5 opacity-90">
                      {{ $t("pages.plugins.guidelines.warning_description") }}
                    </p>
                    <a
                      href="https://blog.counter-strike.net/index.php/server_guidelines/"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="mt-1 inline-block underline underline-offset-2"
                    >
                      {{ $t("pages.plugins.guidelines.warning_link_label") }}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- The plugin's own cvars. Exec'd after the type and global configs
               on servers that load this plugin, and nowhere else. -->
          <section
            v-if="isAdministrator && isRequested && plugin.kind !== 'panel'"
            :class="railSection"
          >
            <div class="flex items-center justify-between gap-2">
              <div :class="sectionLabel">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("pages.plugins.config.title") }}
              </div>
              <FiveStackToolTip v-if="forcedInCfg.length > 0" as-child>
                <template #trigger>
                  <span
                    tabindex="0"
                    role="img"
                    class="inline-flex"
                    :class="TONE_TEXT.warn"
                    :aria-label="forcedWarning"
                  >
                    <AlertTriangle class="h-3.5 w-3.5" />
                  </span>
                </template>
                <span class="block max-w-xs">{{ forcedWarning }}</span>
              </FiveStackToolTip>
            </div>

            <!-- A preview rather than the editor itself: a cvar line wraps
                 three times in the rail. Editing happens in a sheet with
                 room for it. -->
            <pre
              v-if="cfgPreview"
              class="max-h-28 overflow-hidden rounded-md border border-border/60 bg-background/60 px-2.5 py-2 font-mono text-[0.7rem] leading-relaxed text-muted-foreground"
              >{{ cfgPreview }}</pre>
            <p v-else class="text-xs text-muted-foreground">
              {{ $t("pages.plugins.config.empty") }}
            </p>

            <p v-if="configPath" class="text-xs text-muted-foreground">
              {{
                configBaseline === null
                  ? $t("pages.plugins.config_file.status_shipped", {
                      file: configTitle,
                    })
                  : $t("pages.plugins.config_file.status_custom", {
                      file: configTitle,
                    })
              }}
            </p>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 gap-2"
                @click="showCfgDialog = true"
              >
                <Pencil class="h-3.5 w-3.5" />
                {{ $t("pages.plugins.config.edit") }}
              </Button>
            </div>
          </section>

          <section
            v-if="
              plugin.requires_service ||
              workshopAddons.length > 0 ||
              pairedPlugins.length > 0
            "
            :class="railSection"
          >
            <div
              v-if="plugin.requires_service"
              class="flex items-start gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"
            >
              <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {{
                  $t("pages.plugins.requires_service", {
                    service: plugin.requires_service,
                  })
                }}
              </span>
            </div>

            <!-- Every player who joins a server running this downloads these,
                 so it is worth knowing before turning it on. -->
            <div
              v-if="workshopAddons.length > 0"
              class="flex items-start gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"
            >
              <Download class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div class="grid gap-1">
                <span class="font-semibold text-foreground">
                  {{ $t("pages.plugins.workshop_addons.title") }}
                </span>
                <p>
                  {{
                    $t("pages.plugins.workshop_addons.description", {
                      name: plugin.name,
                    })
                  }}
                </p>
                <a
                  v-for="id in workshopAddons"
                  :key="id"
                  :href="`https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 font-mono underline-offset-2 hover:underline"
                >
                  {{ id }}
                  <ExternalLink class="h-3 w-3" />
                </a>
              </div>
            </div>

            <div v-if="pairedPlugins.length > 0" class="grid gap-1.5">
              <div :class="sectionLabel">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("pages.plugins.pairs_with") }}
              </div>
              <!-- A pairing is the other half of a working setup, so it gets
                   a real target rather than a badge. -->
              <NuxtLink
                v-for="paired in pairedPlugins"
                :key="paired.slug"
                :to="`/plugins/${paired.slug}`"
                class="group flex items-center gap-2.5 rounded-lg border border-border/60 p-2.5 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.5)]"
              >
                <span
                  class="grid size-[34px] shrink-0 place-items-center rounded-lg border border-border bg-[hsl(240_5%_9%)] text-muted-foreground"
                >
                  <component :is="kindIcon(paired.kind)" class="h-4 w-4" />
                </span>
                <span class="grid min-w-0 flex-1">
                  <span class="truncate text-sm font-semibold">{{
                    paired.name
                  }}</span>
                  <span class="truncate text-xs text-muted-foreground">
                    {{ $t(`pages.plugins.detail.kind_${paired.kind}`) }}
                  </span>
                </span>
                <ArrowRight
                  class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                />
              </NuxtLink>
            </div>
          </section>

          <section v-if="latestVersions.length > 0" :class="railSection">
            <div :class="sectionLabel">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.plugins.releases") }}
            </div>
            <div class="overflow-hidden rounded-md border border-border">
              <div
                v-for="version in latestVersions"
                :key="`${version.runtime}-${version.version}`"
                class="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 last:border-b-0"
              >
                <div class="grid min-w-0 gap-0.5">
                  <span class="flex flex-wrap items-center gap-1.5">
                    <span class="font-mono text-xs">{{ version.version }}</span>
                    <span
                      v-if="
                        runningVersions.has(version.version) &&
                        version.runtime === runtime
                      "
                      class="inline-flex h-4 items-center rounded bg-success/15 px-1 text-[0.65rem] text-success"
                    >
                      {{ $t("pages.plugins.detail.running") }}
                    </span>
                  </span>
                  <span class="text-[0.7rem] text-muted-foreground">
                    {{ labelForRuntime(version.runtime) }}
                    <template v-if="version.runtime === runtime">
                      · {{ $t("pages.plugins.detail.this_deployment") }}
                    </template>
                  </span>
                </div>
                <span
                  class="shrink-0 text-xs tabular-nums text-muted-foreground"
                >
                  {{
                    new Date(version.published_at).toLocaleDateString(
                      dateLocale(),
                    )
                  }}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
      <Sheet v-model:open="showCfgDialog">
        <SheetContent
          side="right"
          class="flex w-full flex-col gap-0 sm:max-w-2xl motion-reduce:animate-none"
        >
          <SheetHeader class="pr-8">
            <SheetTitle>
              {{ $t("pages.plugins.config.title") }} &mdash; {{ plugin.name }}
            </SheetTitle>
            <SheetDescription>
              {{ $t("pages.plugins.config.hint") }}
            </SheetDescription>
          </SheetHeader>

          <AnimatedFilters
            v-if="cfgTabs.length > 1"
            v-model="cfgTab"
            class="mt-5"
            square
            :options="cfgTabs"
          />

          <div class="-mx-6 mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-4">
            <div v-show="cfgTab === 'settings'" class="space-y-4">
              <PluginCvarForm
                v-if="cvarRows.length > 0"
                :cvars="cvarRows"
                :model-value="pluginCfg"
                @update:model-value="setCfgFromForm"
              />

              <PluginForcedCvars
                :forced="forcedCvars"
                :cfg="pluginCfg"
                :plugin-name="plugin.name"
              />
            </div>

            <PluginConfigFile
              v-if="configPath"
              v-show="cfgTab === 'file'"
              :model-value="pluginConfig"
              :schema="settings?.config_schema ?? null"
              :default-config="settings?.config_default ?? null"
              :path="configPath"
              :repo-url="shippedRepoUrl"
              :can-open-shipped="!!shippedPath && !!shippedNodeId"
              @update:model-value="setConfig"
              @invalid="configInvalid = $event"
              @open-shipped="openShipped"
            />

            <div v-show="cfgTab === 'advanced'" class="space-y-2">
              <div
                class="h-[min(60vh,32rem)] w-full overflow-hidden rounded-md border border-border/60"
              >
                <div ref="cfgEditor" class="h-full w-full" />
              </div>
              <p
                v-if="forcedInCfg.length > 0"
                class="flex items-start gap-1.5 text-xs text-muted-foreground"
              >
                <AlertTriangle
                  class="mt-0.5 h-3.5 w-3.5 shrink-0"
                  :class="TONE_TEXT.warn"
                />
                {{ forcedWarning }}
              </p>
            </div>
          </div>

          <div
            class="-mx-6 flex items-center gap-2 border-t border-border/60 px-6 pt-4"
          >
            <Button
              v-if="cfgTab === 'advanced' && (plugin.cvars ?? []).length > 0"
              type="button"
              variant="ghost"
              size="sm"
              @click="insertCvarTemplate"
            >
              {{ $t("pages.plugins.config.insert_template") }}
            </Button>

            <div class="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                @click="cancelCfg"
              >
                {{ $t("common.cancel") }}
              </Button>
              <Button
                type="button"
                size="sm"
                :disabled="
                  !(cfgDirty || configDirty) ||
                  (configDirty && configInvalid) ||
                  savingCfg
                "
                @click="saveCfg"
              >
                {{ $t("common.save") }}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
import { markRaw } from "vue";
import type * as Monaco from "monaco-editor";
import { loadMonaco } from "~/utilities/loadMonaco";
import PluginLoadTargets from "~/components/game-plugins/PluginLoadTargets.vue";
import type { PluginLoadTargets as LoadTargets } from "~/components/game-plugins/PluginLoadTargets.vue";
import PluginCvarForm from "~/components/game-plugins/PluginCvarForm.vue";
import PluginConfigFile from "~/components/game-plugins/PluginConfigFile.vue";
import PluginForcedCvars from "~/components/game-plugins/PluginForcedCvars.vue";
import {
  cloneConfig,
  cvarsSetIn,
  repoFileUrl,
  type PluginCvar,
} from "~/utilities/pluginConfig";
import gql from "graphql-tag";

// Columns newer than the generated client, so these go out as plain documents.
const PLUGIN_SETTINGS = gql`
  query PluginSettings($slug: String!) {
    game_plugins_by_pk(slug: $slug) {
      slug
      config_cvar
      config_default
      config_schema
      config_shipped
      forced_cvars
      reported_cvars {
        name
        kind
        default_value
        description
      }
    }
    game_plugin_installs_by_pk(plugin_slug: $slug) {
      plugin_slug
      config
    }
  }
`;

const SAVE_PLUGIN_SETTINGS = gql`
  mutation SavePluginSettings(
    $slug: String!
    $set: game_plugin_installs_set_input!
  ) {
    update_game_plugin_installs_by_pk(
      pk_columns: { plugin_slug: $slug }
      _set: $set
    ) {
      plugin_slug
    }
  }
`;

const ALL_NODES = "__all__";

let monaco: typeof Monaco | null = null;

export default {
  components: {
    PluginLoadTargets,
    PluginCvarForm,
    PluginConfigFile,
    PluginForcedCvars,
  },
  data() {
    return {
      cfgEditor: null as Monaco.editor.IStandaloneCodeEditor | null,
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
      loadTargets: {
        load_ranked: false,
        load_tournaments: false,
        load_custom: false,
      } as LoadTargets,
      savingLoadTargets: false,
      showCfgDialog: false,
      pluginCfg: "",
      cfgBaseline: "",
      cfgDirty: false,
      savingCfg: false,
      cfgTab: "settings",
      settings: null as Record<string, any> | null,
      pluginConfig: null as unknown,
      configBaseline: null as string | null,
      configDirty: false,
      configInvalid: false,
      disableGuidelines: false,
      savingGuidelines: false,
      autoUpdate: false,
      savingAutoUpdate: false,
      pinnedVersion: null as string | null,
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
              disable_server_guidelines: true,
              cfg: true,
              load_ranked: true,
              load_tournaments: true,
              load_custom: true,
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
              path: true,
              source: true,
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
            workshop_addons: true,
            config_path: true,
            cvars: true,
            panel: true,
            pairs_with: true,
            versions: [
              {},
              {
                runtime: true,
                version: true,
                published_at: true,
                install_path: true,
                url: true,
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
    settings: {
      query: PLUGIN_SETTINGS,
      context: { optional: true },
      // Shares game_plugins_by_pk with the catalog query, and the type has no
      // id to merge on; caching both would have each evict the other.
      fetchPolicy: "no-cache",
      variables() {
        return { slug: this.$route.params.slug };
      },
      skip() {
        return !this.isAdministrator;
      },
      update(data: Record<string, any>) {
        return {
          ...(data.game_plugins_by_pk ?? {}),
          install_config: data.game_plugin_installs_by_pk?.config ?? null,
        };
      },
      // Until the API's metadata is applied these columns do not exist; the
      // page still works off the catalog's plain cvar list.
      error() {
        this.settings = null;
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
    showCfgDialog(open: boolean) {
      if (open) {
        this.cfgTab = this.cfgTabs[0]?.key ?? "advanced";
        void this.$nextTick(() => this.mountCfgEditor());
        return;
      }

      if (this.configDirty) {
        this.resetConfig();
      }

      // Disposed on close rather than reused: the dialog unmounts its content,
      // so the container the editor was attached to is gone.
      this.cfgEditor?.dispose();
      this.cfgEditor = null;

      // Escape, the X and an overlay click all close without going through
      // cancelCfg. Leaving cfgDirty set there strands the subscription watcher
      // off for the life of the page and shows the draft as if it were saved.
      if (this.cfgDirty) {
        this.pluginCfg = this.cfgBaseline;
        this.cfgDirty = false;
      }
    },
    settings: {
      immediate: true,
      handler() {
        if (!this.configDirty) {
          this.resetConfig();
        }
      },
    },
    desired: {
      immediate: true,
      handler(rows: Array<Record<string, any>>) {
        const row = (rows ?? []).find(
          (entry) => entry.plugin_slug === this.$route.params.slug,
        );
        this.disableGuidelines = Boolean(row?.disable_server_guidelines);
        // Not while the mutation is in flight: the tick that arrives mid-save
        // still carries the old channel, and adopting it visibly throws the
        // switch back to where it was before settling again.
        if (!this.savingAutoUpdate) {
          this.autoUpdate = row?.channel === "Auto";
        }
        this.pinnedVersion = row?.version ?? null;
        this.loadTargets = {
          load_ranked: Boolean(row?.load_ranked),
          load_tournaments: Boolean(row?.load_tournaments),
          load_custom: Boolean(row?.load_custom),
        };

        // Only adopt the stored text while there is nothing unsaved, or a live
        // subscription tick would wipe what is being typed.
        if (!this.cfgDirty) {
          this.cfgBaseline = row?.cfg ?? "";
          this.setCfgValue(this.cfgBaseline);
        }
      },
    },
  },
  beforeUnmount() {
    this.cfgEditor?.dispose();
    this.cfgEditor = null;
  },
  methods: {
    // The node reports where the files actually landed; the catalog-derived
    // directory is only for a node that has not said yet.
    openConfigFiles(nodeId: string) {
      const reported = this.installs.find(
        (entry: Record<string, any>) =>
          entry.game_server_node_id === nodeId &&
          entry.plugin_slug === this.$route.params.slug,
      )?.path;

      useFilePopout().openFiles({
        scope: "node",
        id: nodeId,
        path: reported || this.pluginDirectory,
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
    setCfgValue(value: string) {
      this.pluginCfg = value;

      if (this.cfgEditor && this.cfgEditor.getValue() !== value) {
        this.cfgEditor.setValue(value);
      }
    },
    cancelCfg() {
      this.setCfgValue(this.cfgBaseline);
      this.cfgDirty = false;
      this.resetConfig();
      this.showCfgDialog = false;
    },
    setCfgFromForm(value: string) {
      this.setCfgValue(value);
      this.cfgDirty = value !== this.cfgBaseline;
    },
    setConfig(value: unknown) {
      this.pluginConfig = value;
      this.configDirty =
        (value === null ? null : JSON.stringify(value)) !== this.configBaseline;
    },
    resetConfig() {
      const stored = this.settings?.install_config ?? null;

      this.configBaseline = stored === null ? null : JSON.stringify(stored);
      this.pluginConfig = stored === null ? null : cloneConfig(stored);
      this.configDirty = false;
      this.configInvalid = false;
    },
    openShipped() {
      if (!this.shippedNodeId || !this.shippedPath) {
        return;
      }

      useFilePopout().openFiles({
        scope: "node",
        id: this.shippedNodeId,
        path: this.shippedPath,
      });
    },
    async mountCfgEditor() {
      const el = this.$refs.cfgEditor as HTMLElement | undefined;

      if (!el || this.cfgEditor) {
        return;
      }

      monaco ??= await loadMonaco();

      // The ref can go away, or be replaced by a reopen, while monaco loads.
      // Identity rather than truthiness: a second call that captured a newer
      // element would otherwise let this one build an editor on a detached node
      // that nothing ever disposes.
      if (this.cfgEditor || this.$refs.cfgEditor !== el) {
        return;
      }

      const editor = monaco.editor.create(el, {
        value: this.pluginCfg,
        language: "plaintext",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        tabSize: 2,
        wordWrap: "on",
      });

      editor.onDidChangeModelContent(() => {
        this.pluginCfg = editor.getValue();
        this.cfgDirty = this.pluginCfg !== this.cfgBaseline;
      });

      this.cfgEditor = markRaw(editor);
    },
    insertCvarTemplate() {
      const cvars: Array<string> = this.plugin?.cvars ?? [];

      if (cvars.length === 0) {
        return;
      }

      const existing = new Set(
        this.pluginCfg
          .split("\n")
          .map((line: string) => line.trim().split(/\s+/)[0])
          .filter(Boolean),
      );

      const missing = cvars.filter((cvar) => !existing.has(cvar));

      if (missing.length === 0) {
        return;
      }

      const block = missing.map((cvar) => `${cvar} `).join("\n");
      const next = this.pluginCfg.trim()
        ? `${this.pluginCfg.replace(/\s+$/, "")}\n${block}\n`
        : `${block}\n`;

      this.setCfgValue(next);
      this.cfgDirty = next !== this.cfgBaseline;
    },
    async saveCfg() {
      this.savingCfg = true;

      const value = this.pluginCfg;
      const config = this.pluginConfig;

      try {
        await (this as any).$apollo.mutate({
          mutation: SAVE_PLUGIN_SETTINGS,
          variables: {
            slug: this.$route.params.slug as string,
            set: {
              ...(this.cfgDirty ? { cfg: value } : {}),
              ...(this.configDirty ? { config } : {}),
            },
          },
        });

        this.cfgBaseline = value;
        this.cfgDirty = false;
        this.configBaseline = config === null ? null : JSON.stringify(config);
        this.configDirty = false;
        this.showCfgDialog = false;

        void (this as any).$apollo.queries.settings?.refetch();

        toast({ title: this.$t("pages.plugins.config.saved") });
      } catch (error) {
        toast({ title: (error as Error).message, variant: "destructive" });
      } finally {
        this.savingCfg = false;
      }
    },
    async setLoadTarget(field: keyof LoadTargets, value: boolean) {
      const previous = this.loadTargets[field];

      this.loadTargets = { ...this.loadTargets, [field]: value };
      this.savingLoadTargets = true;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_game_plugin_installs_by_pk: [
              {
                pk_columns: { plugin_slug: this.$route.params.slug as string },
                _set: { [field]: value },
              },
              { plugin_slug: true },
            ],
          }),
        });
      } catch (error) {
        this.loadTargets = { ...this.loadTargets, [field]: previous };
        toast({ title: (error as Error).message, variant: "destructive" });
      } finally {
        this.savingLoadTargets = false;
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
    // Not an update_by_pk like the switches beside it: the channel and the
    // version it pins to have to move together or the row fails its check
    // constraint, and which version to freeze at is only knowable from what
    // the nodes report.
    async setAutoUpdate(value: boolean) {
      this.savingAutoUpdate = true;
      this.autoUpdate = value;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            setGamePluginAutoUpdate: [
              { slug: this.$route.params.slug as string, enabled: value },
              { success: true },
            ],
          }),
        });
      } catch (error) {
        this.autoUpdate = !value;
        toast({ title: (error as Error).message, variant: "destructive" });
      } finally {
        this.savingAutoUpdate = false;
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

      // Dropped in by hand: on disk, but nothing here asked for it.
      if (install.source === "manual") {
        return {
          key: "Manual",
          label:
            install.version ?? this.$t("pages.plugins.store.found_on_disk"),
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
    // By recorded state, not by whether the row names a version: a node
    // reports the version it is downloading with its Installing progress, so
    // "has a version" is true for every node the moment a rollout starts.
    installedOn(nodeId: string) {
      return this.nodeState(nodeId).key === "Installed";
    },
    // With a version the install is pinned there; without one it follows
    // every new release.
    async install(version?: string) {
      const slug = this.$route.params.slug as string;

      await this.run(this.ALL_NODES, () =>
        (this as any).$apollo.mutate({
          mutation: generateMutation({
            installGamePlugin: [
              version ? { slug, version } : { slug },
              { success: true },
            ],
          }),
        }),
      );
    },
    // A retry that left out the version would quietly move a pinned plugin
    // onto auto-update.
    retry() {
      return this.install(
        !this.autoUpdate && this.pinnedVersion ? this.pinnedVersion : undefined,
      );
    },
    async copyCommand() {
      try {
        await navigator.clipboard.writeText(this.panelInstallCommand);
        toast({ title: this.$t("pages.plugins.detail.copied") as string });
      } catch (error) {
        toast({ title: (error as Error).message, variant: "destructive" });
      }
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
    // Comment lines are dropped from the preview: the rail has room for about
    // four, and the cvars are what an operator is checking for at a glance.
    cfgPreview(): string {
      return this.pluginCfg
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.startsWith("//"))
        .slice(0, 4)
        .join("\n");
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
    workshopAddons(): Array<string> {
      return this.plugin?.workshop_addons ?? [];
    },
    // The README tab already resolved the repository for this runtime's
    // build, which is the code someone clicking the byline wants to read.
    repoUrl(): string | null {
      if (this.readmeRepo) {
        return `https://github.com/${this.readmeRepo}`;
      }

      const homepage = this.plugin?.homepage?.match(
        /^https?:\/\/github\.com\/[^/]+\/[^/#?]+/i,
      )?.[0];

      return homepage ?? (this.plugin ? pluginAuthorUrl(this.plugin) : null);
    },
    cvarRows(): Array<PluginCvar> {
      const reported = new Map(
        (this.settings?.reported_cvars ?? []).map(
          (cvar: Record<string, any>) => [cvar.name.toLowerCase(), cvar],
        ),
      );
      const managed = this.configPath
        ? this.settings?.config_cvar?.toLowerCase()
        : null;

      return (this.plugin?.cvars ?? [])
        .filter((name: string) => name.toLowerCase() !== managed)
        .map((name: string) => {
          const cvar = reported.get(name.toLowerCase()) as
            Record<string, any> | undefined;

          return {
            name,
            kind: cvar?.kind ?? null,
            defaultValue: cvar?.default_value ?? null,
            description: cvar?.description || null,
          };
        });
    },
    configPath(): string | null {
      return (
        this.plugin?.config_path?.replaceAll("{runtime}", this.runtime) ?? null
      );
    },
    configTitle(): string {
      return (
        this.settings?.config_schema?.title ??
        (this.$t("pages.plugins.config_file.title") as string)
      );
    },
    forcedCvars(): Array<string> {
      return this.settings?.forced_cvars ?? [];
    },
    forcedInCfg(): Array<string> {
      const set = cvarsSetIn(this.pluginCfg);

      return this.forcedCvars.filter((cvar) => set.has(cvar.toLowerCase()));
    },
    forcedWarning(): string {
      return this.$t("pages.plugins.forced.in_cfg", {
        name: this.plugin?.name ?? "",
        cvars: this.forcedInCfg.join(", "),
      }) as string;
    },
    cfgTabs(): Array<{ key: string; label: string }> {
      return [
        ...(this.cvarRows.length > 0 || this.forcedCvars.length > 0
          ? [{ key: "settings", label: this.$t("pages.plugins.tabs.settings") }]
          : []),
        ...(this.configPath ? [{ key: "file", label: this.configTitle }] : []),
        { key: "advanced", label: this.$t("pages.plugins.tabs.advanced") },
      ] as Array<{ key: string; label: string }>;
    },
    shippedPath(): string | null {
      return (
        this.settings?.config_shipped?.path?.replaceAll(
          "{runtime}",
          this.runtime,
        ) ?? null
      );
    },
    shippedNodeId(): string | null {
      return (
        this.nodes.find((node: Record<string, any>) =>
          this.installedOn(node.id),
        )?.id ?? null
      );
    },
    // At the release the nodes actually installed, so the file matches what
    // is on disk rather than whatever the default branch has moved on to.
    shippedRepoUrl(): string | null {
      const installed = this.installs.find(
        (entry: Record<string, any>) =>
          entry.plugin_slug === this.$route.params.slug &&
          entry.detected &&
          entry.status === "Installed",
      )?.version;
      const forRuntime = this.versions.filter(
        (version: Record<string, any>) => version.runtime === this.runtime,
      );
      const release =
        forRuntime.find(
          (version: Record<string, any>) => version.version === installed,
        ) ?? forRuntime[0];

      return repoFileUrl(
        release?.url,
        this.settings?.config_shipped?.repo_path,
      );
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
    // Used until the node has reported where the files landed. A framework only
    // writes addons/<runtime>/configs/plugins once a plugin has run and put
    // something in it, and a csgo-layout release has no install_path, so the
    // last resort is the plugins directory itself rather than a configs one
    // that may never exist.
    pluginDirectory(): string {
      const runtime = this.runtime;
      const configPath = this.plugin?.config_path;

      if (configPath) {
        const resolved = configPath.replaceAll("{runtime}", runtime);
        const directory = resolved.split("/").slice(0, -1).join("/");

        if (directory) {
          return directory;
        }
      }

      const installPath = this.versions.find(
        (version: Record<string, any>) => version.runtime === runtime,
      )?.install_path;

      if (installPath) {
        return installPath.replaceAll("{runtime}", runtime);
      }

      return `addons/${runtime}/plugins`;
    },
    // Derived from what the nodes have reported rather than the catalog's
    // install_state, which is a query field and would sit still while the
    // rollout it describes moves underneath it.
    rollout(): { key: string; label: string } {
      const failed = this.nodes.filter(
        (node: Record<string, any>) => this.nodeState(node.id).key === "Failed",
      ).length;

      if (failed > 0) {
        return {
          key: "Failed",
          label: this.$t("pages.plugins.state_failed") as string,
        };
      }

      if (this.installedNodeCount >= this.nodes.length) {
        return {
          key: "Installed",
          label: this.$t("pages.plugins.status.Installed") as string,
        };
      }

      if (this.installedNodeCount > 0) {
        return {
          key: "Installing",
          label: this.$t("pages.plugins.status.Installing") as string,
        };
      }

      return {
        key: "Pending",
        label: this.$t("pages.plugins.status.Pending") as string,
      };
    },
    // Both settings, because either one already flips it for the servers that
    // match type runs on, and the account-level risk is the same either way.
    guidelinesOffForRanks(): boolean {
      const settings = useApplicationSettingsStore().settings ?? [];

      return ["fivestack_ranks_matches", "fivestack_ranks_tournaments"].some(
        (name) =>
          settings.find((setting: Record<string, any>) => setting.name === name)
            ?.value === "true",
      );
    },
    canRemoveFromCatalog(): boolean {
      return (
        this.plugin?.source === "custom" &&
        !this.isRequested &&
        this.installedNodeCount === 0
      );
    },
    readmeIndex(): number {
      return Math.max(
        0,
        this.readmeVariants.findIndex(
          (variant: Record<string, any>) => variant.key === this.readmeRuntime,
        ),
      );
    },
    pluginInstalls(): Array<Record<string, any>> {
      return this.installs.filter(
        (entry: Record<string, any>) =>
          entry.plugin_slug === this.$route.params.slug,
      );
    },
    nodeLabel(): (id: string) => string {
      const labels = new Map(
        this.nodes.map((node: Record<string, any>) => [
          node.id,
          node.label ?? node.id,
        ]),
      );
      return (id: string) => (labels.get(id) as string) ?? id;
    },
    // On disk without being asked for: someone put it there by hand.
    isManual(): boolean {
      return (
        !this.isRequested &&
        this.pluginInstalls.some(
          (entry: Record<string, any>) => entry.source === "manual",
        )
      );
    },
    manualNodeLabels(): Array<string> {
      return this.pluginInstalls
        .filter((entry: Record<string, any>) => entry.source === "manual")
        .map((entry: Record<string, any>) =>
          this.nodeLabel(entry.game_server_node_id),
        );
    },
    failedNodeLabels(): Array<string> {
      return this.nodes
        .filter(
          (node: Record<string, any>) =>
            this.nodeState(node.id).key === "Failed",
        )
        .map((node: Record<string, any>) => node.label ?? node.id);
    },
    onlineNodeCount(): number {
      return this.nodes.filter((node: Record<string, any>) =>
        ["Online", "NotAcceptingNewMatches"].includes(node.status),
      ).length;
    },
    latestForRuntime(): string | null {
      return (
        this.versions.find(
          (version: Record<string, any>) => version.runtime === this.runtime,
        )?.version ?? null
      );
    },
    // Pinned behind the newest release: the one case with something to
    // update to, since auto-update installs releases on its own.
    updateVersion(): string | null {
      if (this.autoUpdate || !this.pinnedVersion || !this.latestForRuntime) {
        return null;
      }
      return this.pinnedVersion === this.latestForRuntime
        ? null
        : this.latestForRuntime;
    },
    runningVersions(): Set<string> {
      return new Set(
        this.pluginInstalls
          .filter(
            (entry: Record<string, any>) =>
              entry.detected && entry.status === "Installed" && entry.version,
          )
          .map((entry: Record<string, any>) => entry.version),
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
      return this.versions.some((version) => version.runtime === this.runtime);
    },
  },
};
</script>
