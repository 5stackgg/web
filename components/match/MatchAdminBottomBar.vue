<script lang="ts" setup>
import { ref, computed, provide, onMounted, onBeforeUnmount } from "vue";
import EventEmitter from "eventemitter3";
import { useMatchBackupRounds } from "~/composables/useMatchBackupRounds";
import { ChevronUp, GripHorizontal, Shield } from "lucide-vue-next";
import MatchServerRebootControl from "~/components/match/MatchServerRebootControl.vue";
import RconCommander from "~/components/servers/RconCommander.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { Button } from "~/components/ui/button";
import DropdownMenuItem from "~/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "~/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuSub from "~/components/ui/dropdown-menu/DropdownMenuSub.vue";
import DropdownMenuSubTrigger from "~/components/ui/dropdown-menu/DropdownMenuSubTrigger.vue";
import DropdownMenuSubContent from "~/components/ui/dropdown-menu/DropdownMenuSubContent.vue";
import { e_match_map_status_enum, e_match_status_enum } from "~/generated/zeus";

const props = defineProps<{
  match: Record<string, any>;
}>();

const commander = new EventEmitter();
provide("commander", commander);

enum AvailableCommands {
  Pause = "css_pause",
  Resume = "css_resume",
  SkipKnife = "skip_knife",
  ForceReady = "force_ready",
  Knife = "match_state Knife",
  Warmup = "match_state Warmup",
}

type CommandDetail = {
  display: string;
  value: AvailableCommands;
  confirm?: boolean;
};

const CommandDetails: Record<string, CommandDetail> = {
  [AvailableCommands.Pause]: {
    display: "Pause Match",
    value: AvailableCommands.Pause,
  },
  [AvailableCommands.Resume]: {
    display: "Resume Match",
    value: AvailableCommands.Resume,
  },
  [AvailableCommands.SkipKnife]: {
    display: "Skip Knife",
    value: AvailableCommands.SkipKnife,
  },
  [AvailableCommands.ForceReady]: {
    display: "Force Ready",
    value: AvailableCommands.ForceReady,
  },
  [AvailableCommands.Knife]: {
    display: "Reset to Knife",
    value: AvailableCommands.Knife,
    confirm: true,
  },
  [AvailableCommands.Warmup]: {
    display: "Reset to Warmup",
    value: AvailableCommands.Warmup,
    confirm: true,
  },
};

const open = ref(false);
const mounted = ref(false);
const hasLogs = ref(false);
const showConfirmDialog = ref(false);
const showRebootDialog = ref(false);
const pendingCommand = ref<CommandDetail | null>(null);
const executePending = ref<(() => void) | null>(null);

const panelHeight = ref(240);
const dragging = ref(false);
const MIN_HEIGHT = 120;

function maxHeight() {
  return Math.round(window.innerHeight * 0.9);
}

let activeMove: ((ev: MouseEvent) => void) | null = null;
let activeUp: (() => void) | null = null;

function stopDrag() {
  if (activeMove) document.removeEventListener("mousemove", activeMove);
  if (activeUp) document.removeEventListener("mouseup", activeUp);
  activeMove = null;
  activeUp = null;
  dragging.value = false;
}

function startDrag(e: MouseEvent) {
  e.preventDefault();
  stopDrag();
  dragging.value = true;
  const startY = e.clientY;
  const startHeight = panelHeight.value;

  activeMove = (ev: MouseEvent) => {
    const delta = startY - ev.clientY;
    panelHeight.value = Math.max(
      MIN_HEIGHT,
      Math.min(maxHeight(), startHeight + delta),
    );
  };
  activeUp = () => stopDrag();

  document.addEventListener("mousemove", activeMove);
  document.addEventListener("mouseup", activeUp);
}

onMounted(() => {
  panelHeight.value = Math.round(window.innerHeight * 0.45);
  // Only enable the teleport once its target is actually in the DOM.
  // On a fresh load the layout's #main-bottom-dock can mount a frame
  // after this component, and flipping `mounted` while the target is
  // missing makes Vue move the teleport into a null node
  // (moveTeleport -> insertBefore on null).
  const enableTeleport = () => {
    if (document.getElementById("main-bottom-dock")) {
      mounted.value = true;
    } else {
      requestAnimationFrame(enableTeleport);
    }
  };
  enableTeleport();
});

onBeforeUnmount(() => {
  stopDrag();
});

const currentMap = computed(() =>
  props.match.match_maps?.find((m: any) => m.is_current_map),
);

const availableCommands = computed<CommandDetail[]>(() => {
  const commands: CommandDetail[] = [];
  switch (currentMap.value?.status) {
    case e_match_map_status_enum.Warmup:
    case e_match_map_status_enum.Scheduled:
      commands.push(CommandDetails[AvailableCommands.ForceReady]);
      break;
    case e_match_map_status_enum.Knife:
      commands.push(CommandDetails[AvailableCommands.SkipKnife]);
      commands.push(CommandDetails[AvailableCommands.Warmup]);
      break;
    case e_match_map_status_enum.Paused:
      commands.push(CommandDetails[AvailableCommands.Resume]);
      commands.push(CommandDetails[AvailableCommands.Warmup]);
      commands.push(CommandDetails[AvailableCommands.Knife]);
      break;
    case e_match_map_status_enum.Live:
    case e_match_map_status_enum.Overtime:
      commands.push(CommandDetails[AvailableCommands.Pause]);
      break;
  }
  return commands;
});

const canSendRCONCommands = computed(
  () =>
    [
      e_match_status_enum.Live,
      e_match_status_enum.PickingPlayers,
      e_match_status_enum.Scheduled,
      e_match_status_enum.Veto,
      e_match_status_enum.WaitingForCheckIn,
      e_match_status_enum.WaitingForServer,
    ].includes(props.match.status) && !!props.match.server_id,
);

const canShowLogs = computed(
  () =>
    ![
      e_match_status_enum.Scheduled,
      e_match_status_enum.WaitingForCheckIn,
      e_match_status_enum.PickingPlayers,
      e_match_status_enum.Veto,
    ].includes(props.match.status),
);

// match_map_rounds is gated to finished maps (anti-cheat), so the restorable
// rounds come from the dedicated v_match_map_backup_rounds view instead. Shared
// subscription so this and MatchTabs don't open two identical websockets.
const { backupRounds } = useMatchBackupRounds(
  computed(() => currentMap.value?.id),
);

const restorableRounds = computed(() =>
  backupRounds.value.filter((r: any) => r.has_backup_file && r.round > 0),
);

function runCommand(
  command: CommandDetail,
  send: (cmd: string, arg: string) => void,
) {
  if (command.confirm) {
    pendingCommand.value = command;
    executePending.value = () => send(command.value, "");
    showConfirmDialog.value = true;
    return;
  }
  send(command.value, "");
}
</script>

<template>
  <Teleport to="#main-bottom-dock" :disabled="!mounted">
    <div
      class="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <AlertDialog :open="showConfirmDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ $t("common.confirm") }}</AlertDialogTitle>
            <AlertDialogDescription class="flex flex-col gap-2">
              <span>{{ $t("common.are_you_sure") }}</span>
              <Badge variant="secondary" class="w-fit">
                {{ pendingCommand?.display }}
              </Badge>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="showConfirmDialog = false">
              {{ $t("common.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction
              @click="
                executePending && executePending();
                showConfirmDialog = false;
              "
            >
              {{ $t("common.confirm") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <!-- Reboot confirm lives here (not in the RCON dropdown) so it survives
           the dropdown unmounting when the menu closes. -->
      <MatchServerRebootControl
        :match="match"
        variant="dialog"
        v-model:open="showRebootDialog"
      />

      <div
        v-show="open"
        class="group h-2 cursor-ns-resize bg-border hover:bg-[hsl(var(--tac-amber)/0.4)] transition-colors flex items-center justify-center"
        @mousedown="startDrag"
      >
        <GripHorizontal
          class="w-4 h-4 text-muted-foreground/60 group-hover:text-[hsl(var(--tac-amber))] transition-colors pointer-events-none"
        />
      </div>

      <button
        type="button"
        class="flex items-center gap-3 w-full px-4 py-2 hover:bg-muted/40 transition-colors duration-200 ease-out text-left"
        :class="dragging && 'select-none'"
        :aria-expanded="open"
        @click="open = !open"
      >
        <div
          class="inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase border rounded transition-colors duration-200 ease-out"
          :class="
            canSendRCONCommands
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
              : 'border-border bg-muted/40 text-muted-foreground'
          "
        >
          <Shield class="w-3 h-3" />
          {{ $t("match.admin") }}
        </div>

        <span
          v-if="canSendRCONCommands"
          class="font-mono text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground"
        >
          {{
            match.is_server_online
              ? $t("common.connected")
              : $t("common.disconnected")
          }}
        </span>

        <span
          class="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {{ open ? $t("common.close") : $t("common.more") }}
          <ChevronUp
            class="w-4 h-4 transition-transform duration-300 ease-out"
            :class="open ? 'rotate-180' : 'rotate-0'"
          />
        </span>
      </button>

      <div
        class="overflow-hidden"
        :class="[
          !dragging && 'transition-[height] duration-300 ease-out',
          open && 'border-t',
        ]"
        :style="{ height: open ? `${panelHeight}px` : '0px' }"
      >
        <div
          class="h-full min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-4 overflow-auto lg:overflow-hidden"
        >
          <div
            class="min-w-0 flex flex-col gap-3 lg:min-h-0 lg:overflow-hidden"
          >
            <RconCommander
              v-if="canSendRCONCommands"
              :server-id="match.server_id"
              :online="!!match.is_server_online"
              :match-id="match.id"
              :compact="true"
              class="lg:flex-1 lg:min-h-0"
            >
              <template #default="{ commander: send }">
                <DropdownMenuItem
                  v-for="command of availableCommands"
                  :key="command.value"
                  :disabled="!match.is_server_online"
                  @click="runCommand(command, send)"
                >
                  {{ command.display }}
                </DropdownMenuItem>

                <template v-if="restorableRounds.length > 0">
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger :disabled="!match.is_server_online">
                    {{ $t("match.tabs.restore_round") }}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent class="max-h-80 overflow-y-auto">
                    <DropdownMenuItem
                      v-for="round of restorableRounds"
                      :key="round.round"
                      :disabled="!match.is_server_online"
                      @click="send('restore_round', round.round.toString())"
                    >
                      {{
                        $t("common.round", {
                          number: round.round.toString(),
                        })
                      }}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                </template>
              </template>

              <template #footer>
                <MatchServerRebootControl
                  :match="match"
                  variant="menu-item"
                  v-model:open="showRebootDialog"
                />
              </template>
            </RconCommander>

            <div
              v-else
              class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center h-full"
            >
              <h3 class="font-semibold">
                {{ $t("match.admin_bar.rcon_unavailable") }}
              </h3>
              <p class="text-sm text-muted-foreground">
                {{ $t("match.admin_bar.not_controllable") }}
              </p>
            </div>
          </div>

          <div
            class="min-w-0 flex flex-col gap-2 lg:min-h-0 lg:overflow-hidden"
          >
            <div
              v-if="!canShowLogs || !hasLogs"
              class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center"
            >
              <h3 class="font-semibold">
                {{ $t("match.tabs.no_logs_title") }}
              </h3>
              <p class="text-sm text-muted-foreground">
                {{ $t("match.tabs.no_logs_description") }}
              </p>
            </div>
            <div
              v-if="canShowLogs"
              v-show="hasLogs"
              class="lg:flex-1 lg:min-h-0"
            >
              <ServiceLogs
                :service="`m-${match.id}`"
                :compact="true"
                @has-logs="hasLogs = $event"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
