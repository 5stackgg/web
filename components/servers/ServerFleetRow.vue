<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Copy,
  Ellipsis,
  FolderOpen,
  PanelRightOpen,
  Power,
  Terminal,
  Trash2,
  TriangleAlert,
} from "lucide-vue-next";
import { Switch } from "~/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import StatusDot from "~/components/admin/StatusDot.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import {
  hostLabel,
  pluginOutdated,
  serverAddress,
  serverStatus,
  serverType,
  type FleetContext,
} from "./serverFleet";

const props = defineProps<{
  server: any;
  ctx: FleetContext;
  canFiles?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-enabled"): void;
  (e: "delete"): void;
  (e: "copy", address: string): void;
  (e: "files"): void;
}>();

const { t } = useI18n();

const to = computed(() => `/dedicated-servers/${props.server.id}`);
const address = computed(() => serverAddress(props.server));
const status = computed(() => serverStatus(props.server, props.ctx));
const word = computed(() => t(...(status.value.word as [string, any])));
const tip = computed(() => t(...(status.value.tip as [string, any])));
const sub = computed(() =>
  status.value.sub ? t(...(status.value.sub as [string, any])) : "",
);
const outdated = computed(
  () => props.server.enabled && pluginOutdated(props.server, props.ctx),
);
const players = computed(() =>
  props.ctx.players?.has(props.server.id)
    ? (props.ctx.players.get(props.server.id) ?? 0)
    : null,
);
const showPlayers = computed(
  () =>
    props.server.enabled && props.server.connected && players.value !== null,
);

// A healthy server's word reads plain; the dot carries the green.
const wordClass = computed(() =>
  status.value.tone === "ok" ? "text-foreground" : TONE_TEXT[status.value.tone],
);

function open(event: MouseEvent) {
  if (
    (event.target as HTMLElement).closest(
      "button, a, input, label, [role='switch'], [role='menuitem']",
    )
  ) {
    return;
  }
  go();
}

function go() {
  navigateTo(to.value);
}
</script>

<template>
  <!-- The list's keyboard (roving tabindex, Enter opens) comes in through
       the parent's rowProps. -->
  <tr
    class="group/row cursor-pointer border-b border-border/50 transition-colors duration-150 last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none data-[active=true]:bg-muted/30"
    :class="!server.enabled && 'text-muted-foreground'"
    :data-server-id="server.id"
    @click="open"
  >
    <td class="px-3 py-2 md:min-w-[240px]">
      <div class="grid min-w-0 gap-0.5">
        <NuxtLink
          :to="to"
          class="line-clamp-2 max-w-[320px] break-words font-semibold transition-colors duration-150 hover:text-[hsl(var(--tac-amber))]"
          :class="server.enabled ? 'text-foreground' : 'text-muted-foreground'"
        >
          {{ server.label || address }}
        </NuxtLink>
        <span
          class="inline-flex min-w-0 items-center gap-1 font-mono text-[0.72rem] text-muted-foreground/80"
        >
          <span class="truncate">{{ address }}</span>
          <button
            type="button"
            class="grid size-5 shrink-0 place-items-center rounded opacity-0 transition-opacity duration-150 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
            :aria-label="$t('pages.dedicated_servers.copy_address')"
            @click="emit('copy', address)"
          >
            <Copy class="size-3" />
          </button>
        </span>
        <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            class="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.75rem]"
            :class="wordClass"
            :title="tip"
          >
            <StatusDot :tone="status.tone" :live="status.live" />
            {{ word }}
          </span>
          <span
            v-if="sub"
            class="whitespace-nowrap text-[0.72rem] tabular-nums text-muted-foreground"
          >
            · {{ sub }}
          </span>
        </span>
      </div>
    </td>

    <td class="whitespace-nowrap px-3 py-2 max-md:hidden">
      <span
        class="inline-flex h-5 items-center rounded-[5px] border border-border bg-muted/40 px-1.5 text-[0.7rem] font-medium text-muted-foreground"
      >
        {{ serverType(server) }}
      </span>
    </td>

    <td class="px-3 py-2 max-md:hidden">
      <NuxtLink
        v-if="server.game_server_node_id"
        to="/game-server-nodes"
        class="block max-w-[160px] truncate font-mono text-xs underline decoration-muted-foreground/60 decoration-dotted underline-offset-[3px] transition-colors duration-150 hover:text-[hsl(var(--tac-amber))]"
        :title="$t('pages.dedicated_servers.open_node')"
      >
        {{ hostLabel(server) }}
      </NuxtLink>
      <span v-else class="text-[0.78rem] text-muted-foreground">
        {{ $t("pages.dedicated_servers.external") }}
      </span>
    </td>

    <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">
      <template v-if="showPlayers">
        {{ players
        }}<span class="ml-1 text-[0.72rem] text-muted-foreground/80"
          >/ {{ server.max_players }}</span
        >
      </template>
      <span v-else class="text-muted-foreground/60">—</span>
    </td>

    <td class="whitespace-nowrap px-3 py-2 max-md:hidden">
      <span v-if="!server.plugin_version" class="text-muted-foreground/60"
        >—</span
      >
      <span
        v-else-if="outdated"
        class="inline-flex items-center gap-1 font-mono text-xs tabular-nums"
        :class="TONE_TEXT.warn"
        :title="
          $t('pages.dedicated_servers.plugin_outdated_tip', {
            version: ctx.currentPluginVersion,
          })
        "
      >
        <TriangleAlert class="size-3 shrink-0" />
        v{{ server.plugin_version }} &rarr; v{{ ctx.currentPluginVersion }}
      </span>
      <span v-else class="font-mono text-xs tabular-nums">
        v{{ server.plugin_version }}
      </span>
    </td>

    <td
      class="whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums max-md:hidden"
    >
      {{ server.port
      }}<span class="ml-1 text-[0.72rem] text-muted-foreground/80"
        >({{ server.tv_port }})</span
      >
    </td>

    <td class="px-3 py-2 max-md:hidden">
      <Switch
        @click.stop
        :model-value="server.enabled"
        :aria-label="
          $t('pages.dedicated_servers.enabled_for', {
            label: server.label || address,
          })
        "
        @update:model-value="emit('toggle-enabled')"
      />
    </td>

    <td class="w-12 px-2 py-2 text-right">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
            :aria-label="
              $t('pages.dedicated_servers.more_for', {
                label: server.label || address,
              })
            "
          >
            <Ellipsis class="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
          <DropdownMenuItem as-child>
            <NuxtLink :to="to">
              <PanelRightOpen />
              {{ $t("pages.dedicated_servers.open") }}
            </NuxtLink>
          </DropdownMenuItem>
          <DropdownMenuItem @select="emit('copy', address)">
            <Copy />
            {{ $t("pages.dedicated_servers.copy_address") }}
          </DropdownMenuItem>
          <DropdownMenuItem as-child>
            <NuxtLink :to="`${to}?tab=console`">
              <Terminal />
              {{ $t("pages.dedicated_servers.open_console") }}
            </NuxtLink>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="canFiles && server.game_server_node_id"
            @select="emit('files')"
          >
            <FolderOpen />
            {{ $t("pages.dedicated_servers.detail.files") }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="emit('toggle-enabled')">
            <Power />
            {{
              server.enabled
                ? $t("pages.dedicated_servers.disable_server")
                : $t("pages.dedicated_servers.enable_server")
            }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="text-destructive focus:text-destructive"
            @select="emit('delete')"
          >
            <Trash2 />
            {{ $t("pages.dedicated_servers.delete_server") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  </tr>
</template>
