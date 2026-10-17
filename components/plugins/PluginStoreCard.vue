<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowUpCircle,
  Ban,
  Check,
  CircleAlert,
  Download,
  Hand,
  LayoutDashboard,
  Package,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { pluginAuthorUrl } from "~/utilities/pluginAuthor";
import {
  installFraction,
  pluginRuntimes,
  runtimeLabel,
  type PluginCardState,
} from "~/components/plugins/pluginDirectoryState";

const props = defineProps<{
  plugin: Record<string, any>;
  state: PluginCardState;
  runtime: string;
  panelRoute?: string | null;
  busy?: boolean;
}>();

const emit = defineEmits<{
  (e: "install"): void;
  (e: "retry"): void;
  (e: "update", version: string): void;
}>();

const confirming = ref(false);

const kindIcon = computed(() => {
  if (props.plugin.kind === "panel") {
    return LayoutDashboard;
  }
  return props.plugin.kind === "bundle" ? Package : Puzzle;
});

const runtimes = computed(() => pluginRuntimes(props.plugin));
const tags = computed<string[]>(() => (props.plugin.tags ?? []).slice(0, 4));
const authorUrl = computed(() => pluginAuthorUrl(props.plugin));
const hasChips = computed(
  () =>
    props.plugin.source === "custom" ||
    props.plugin.requires_server_guidelines_disabled,
);

const meter = computed(() =>
  props.state.key === "installing"
    ? installFraction(props.state.installed, props.state.target)
    : 0,
);

function confirmInstall() {
  confirming.value = false;
  emit("install");
}
</script>

<template>
  <article
    class="group relative grid grid-rows-[auto_auto_1fr_auto] gap-2.5 rounded-lg border border-border bg-card/40 p-4 transition-[border-color,transform] duration-150 ease-out hover:-translate-y-px hover:border-[hsl(240_4%_26%)] motion-reduce:hover:translate-y-0"
  >
    <NuxtLink
      :to="`/plugins/${plugin.slug}`"
      class="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
      :aria-label="$t('pages.plugins.store.open_aria', { name: plugin.name })"
    />

    <div class="flex items-start gap-3">
      <span
        class="grid size-[52px] shrink-0 place-items-center rounded-[10px] border border-border bg-[hsl(240_5%_9%)] text-muted-foreground"
      >
        <component :is="kindIcon" class="size-[22px]" />
      </span>

      <!-- The name owns its line and wraps; the warning chips sit under it,
           so a long name never gets squeezed down to an ellipsis. -->
      <div class="pointer-events-none relative z-[2] grid min-w-0 gap-1">
        <span
          class="flex items-start gap-1.5 text-[0.95rem] font-semibold leading-snug"
        >
          <span class="min-w-0 break-words">{{ plugin.name }}</span>
          <FiveStackToolTip v-if="plugin.verified" as-child>
            <template #trigger>
              <span
                tabindex="0"
                role="img"
                class="pointer-events-auto mt-0.5 inline-flex shrink-0 text-success"
                :aria-label="$t('pages.plugins.verified')"
              >
                <ShieldCheck class="h-4 w-4" />
              </span>
            </template>
            {{ $t("pages.plugins.store.verified_hint") }}
          </FiveStackToolTip>
        </span>

        <span v-if="hasChips" class="flex flex-wrap gap-1">
          <FiveStackToolTip v-if="plugin.source === 'custom'" as-child>
            <template #trigger>
              <span
                tabindex="0"
                class="pointer-events-auto inline-flex h-5 items-center gap-1 rounded-md border border-border px-1.5 text-[0.7rem] text-muted-foreground"
              >
                <Wrench class="h-3 w-3" />
                {{ $t("pages.plugins.custom.badge") }}
              </span>
            </template>
            {{ $t("pages.plugins.store.custom_hint") }}
          </FiveStackToolTip>
          <FiveStackToolTip
            v-if="plugin.requires_server_guidelines_disabled"
            as-child
          >
            <template #trigger>
              <span
                tabindex="0"
                class="pointer-events-auto inline-flex h-5 items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 text-[0.7rem] text-warning"
              >
                <TriangleAlert class="h-3 w-3" />
                {{ $t("pages.plugins.guidelines.badge") }}
              </span>
            </template>
            {{ $t("pages.plugins.store.guidelines_hint") }}
          </FiveStackToolTip>
        </span>

        <span class="text-xs text-muted-foreground">
          <a
            v-if="authorUrl"
            :href="authorUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="pointer-events-auto underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            {{ $t("pages.plugins.by", { author: plugin.author }) }}
          </a>
          <template v-else>
            {{ $t("pages.plugins.by", { author: plugin.author }) }}
          </template>
        </span>
      </div>
    </div>

    <p class="line-clamp-3 text-[0.8rem] leading-relaxed text-muted-foreground">
      {{ plugin.description }}
    </p>

    <div class="flex flex-wrap gap-1 self-end">
      <span
        v-for="item in runtimes"
        :key="item"
        class="inline-flex h-5 items-center rounded-md bg-muted/60 px-1.5 text-[0.68rem] text-foreground/80"
      >
        {{ runtimeLabel(item) }}
      </span>
      <span
        v-for="tag in tags"
        :key="tag"
        class="inline-flex h-5 items-center rounded-md border border-border/60 px-1.5 text-[0.68rem] text-muted-foreground"
      >
        {{ tag }}
      </span>
    </div>

    <!-- The footer is the install state: what the plugin is doing on this
         deployment and the one thing to press about it. -->
    <div
      class="relative z-[2] flex min-h-[45px] flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-[0.8rem]"
    >
      <template v-if="state.key === 'panel-installed'">
        <span
          class="inline-flex flex-1 items-center gap-1.5 text-muted-foreground"
        >
          <Check class="h-3.5 w-3.5 text-success" />
          {{ $t("pages.plugins.store.on_panel") }}
        </span>
        <Button
          v-if="panelRoute"
          as-child
          size="sm"
          variant="outline"
          class="h-7"
        >
          <NuxtLink :to="`/apps/${panelRoute}`">
            {{ $t("pages.plugins.open_plugin") }}
          </NuxtLink>
        </Button>
      </template>

      <template v-else-if="state.key === 'panel-available'">
        <span class="flex-1 text-muted-foreground">
          {{ $t("pages.plugins.store.panel_host") }}
        </span>
        <Button as-child size="sm" variant="outline" class="h-7">
          <NuxtLink :to="`/plugins/${plugin.slug}`">
            {{ $t("pages.plugins.store.set_up") }}
          </NuxtLink>
        </Button>
      </template>

      <template v-else-if="state.key === 'incompatible'">
        <span
          class="inline-flex flex-1 items-center gap-1.5 text-muted-foreground/70"
        >
          <Ban class="h-3.5 w-3.5" />
          {{
            $t("pages.plugins.store.no_build", {
              runtime: runtimeLabel(runtime),
            })
          }}
        </span>
        <span
          v-if="state.runtimes.length"
          class="text-xs text-muted-foreground"
        >
          {{
            $t("pages.plugins.store.only", {
              runtimes: state.runtimes.map(runtimeLabel).join(", "),
            })
          }}
        </span>
      </template>

      <span v-else-if="state.key === 'no-nodes'" class="text-muted-foreground">
        {{ $t("pages.plugins.store.add_node") }}
      </span>

      <template v-else-if="state.key === 'install' || state.key === 'manual'">
        <span
          v-if="state.key === 'install'"
          class="flex-1 font-mono text-xs text-muted-foreground"
        >
          {{ state.latest }}
        </span>
        <span v-else class="flex flex-1">
          <FiveStackToolTip as-child>
            <template #trigger>
              <span
                tabindex="0"
                class="inline-flex items-center gap-1.5 text-warning"
              >
                <Hand class="h-3.5 w-3.5" />
                {{ $t("pages.plugins.store.found_on_disk") }}
              </span>
            </template>
            {{ $t("pages.plugins.store.found_on_disk_hint") }}
          </FiveStackToolTip>
        </span>

        <!-- Every online node is the only rollout the api records today, so
             the confirm says exactly that rather than offering a node pick it
             could not honour. -->
        <Popover v-model:open="confirming">
          <PopoverTrigger as-child>
            <Button size="sm" variant="outline" class="h-7" :loading="busy">
              <Download v-if="state.key === 'install'" class="h-3.5 w-3.5" />
              {{
                state.key === "install"
                  ? $t("pages.plugins.install")
                  : $t("pages.plugins.store.manage_here")
              }}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-[min(90vw,280px)] space-y-3 p-3">
            <p class="text-sm font-medium">
              {{
                $t("pages.plugins.store.install_title", {
                  name: plugin.name,
                  version: state.latest,
                })
              }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{
                $t("pages.plugins.installs_everywhere", {
                  count: plugin.target_node_count ?? 0,
                })
              }}
            </p>
            <div class="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                class="h-7"
                @click="confirming = false"
              >
                {{ $t("common.cancel") }}
              </Button>
              <Button
                size="sm"
                class="h-7 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
                @click="confirmInstall"
              >
                <Download class="h-3.5 w-3.5" />
                {{ $t("pages.plugins.install") }}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </template>

      <template v-else-if="state.key === 'failed'">
        <span class="inline-flex flex-1 items-center gap-1.5 text-destructive">
          <CircleAlert class="h-3.5 w-3.5 shrink-0" />
          <template v-if="state.nodes.length === 1">
            {{ $t("pages.plugins.store.failed_on", { node: state.nodes[0] }) }}
          </template>
          <template v-else-if="state.nodes.length > 1">
            {{
              $t(
                "pages.plugins.store.failed_on_nodes",
                { count: state.nodes.length },
                state.nodes.length,
              )
            }}
          </template>
          <template v-else>
            {{ $t("pages.plugins.store.install_failed") }}
          </template>
        </span>
        <Button
          size="sm"
          variant="outline"
          class="h-7"
          :loading="busy"
          @click="emit('retry')"
        >
          <RefreshCw class="h-3.5 w-3.5" />
          {{ $t("pages.plugins.retry") }}
        </Button>
      </template>

      <div v-else-if="state.key === 'installing'" class="grid flex-1 gap-1.5">
        <span
          class="inline-flex items-center gap-1.5 tabular-nums text-[hsl(var(--tac-amber))]"
        >
          <Download class="h-3.5 w-3.5" />
          <template v-if="state.target > 0">
            {{
              $t("pages.plugins.store.installing_on", {
                installed: state.installed,
                total: state.target,
              })
            }}
          </template>
          <template v-else>
            {{ $t("pages.plugins.store.waiting_nodes") }}
          </template>
        </span>
        <div class="h-1 overflow-hidden rounded-full bg-muted/60">
          <div
            class="h-full origin-left rounded-full bg-[hsl(var(--tac-amber))] motion-reduce:!transition-none"
            :style="{
              transform: `scaleX(${meter})`,
              transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
            }"
          />
        </div>
      </div>

      <template v-else-if="state.key === 'update'">
        <i18n-t
          keypath="pages.plugins.store.pinned_at"
          tag="span"
          class="flex-1 text-muted-foreground"
        >
          <template #version>
            <span class="font-mono text-xs text-foreground/80">{{
              state.current
            }}</span>
          </template>
        </i18n-t>
        <Button
          size="sm"
          variant="outline"
          class="h-7"
          :loading="busy"
          @click="emit('update', state.latest)"
        >
          <ArrowUpCircle class="h-3.5 w-3.5" />
          {{ $t("pages.plugins.store.update_to", { version: state.latest }) }}
        </Button>
      </template>

      <template v-else-if="state.key === 'installed'">
        <span
          class="inline-flex flex-1 items-center gap-1.5 text-muted-foreground"
        >
          <Check class="h-3.5 w-3.5 text-success" />
          {{ $t("pages.plugins.installed") }}
          <span class="font-mono text-xs text-muted-foreground">{{
            state.version
          }}</span>
        </span>
        <Button as-child size="sm" variant="ghost" class="h-7">
          <NuxtLink :to="`/plugins/${plugin.slug}`">
            {{ $t("pages.plugins.manage") }}
          </NuxtLink>
        </Button>
      </template>
    </div>
  </article>
</template>
