<script lang="ts" setup>
import { ref, computed, provide } from "vue";
import EventEmitter from "eventemitter3";
import { ChevronDown, ChevronUp, Shield } from "lucide-vue-next";
import RconCommander from "~/components/servers/RconCommander.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { Button } from "~/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  e_match_map_status_enum,
  e_match_status_enum,
} from "~/generated/zeus";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";

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

const expanded = ref(false);
const hasLogs = ref(false);
const showConfirmDialog = ref(false);
const pendingCommand = ref<CommandDetail | null>(null);
const executePending = ref<(() => void) | null>(null);

const form = useForm({
  validationSchema: toTypedSchema(
    z.object({
      round: z.string(),
    }),
  ),
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

const canSendRCONCommands = computed(() =>
  [
    e_match_status_enum.Live,
    e_match_status_enum.PickingPlayers,
    e_match_status_enum.Scheduled,
    e_match_status_enum.Veto,
    e_match_status_enum.WaitingForCheckIn,
    e_match_status_enum.WaitingForServer,
  ].includes(props.match.status),
);

const restorableRounds = computed(() =>
  (currentMap.value?.rounds ?? []).filter(
    (r: any) => r.has_backup_file && r.round > 0,
  ),
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
  <div
    class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
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

    <RconCommander
      v-if="canSendRCONCommands"
      :server-id="match.server_id"
      :online="match.is_server_online"
      :match-id="match.id"
      v-slot="{ commander: send }"
    >
      <div class="flex items-center gap-2 px-4 py-2 flex-wrap">
        <div
          class="inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase border border-[hsl(var(--tac-amber)/0.5)] rounded bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]"
        >
          <Shield class="w-3 h-3" />
          Admin
        </div>

        <span
          class="font-mono text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground"
        >
          {{
            match.is_server_online
              ? $t("common.connected")
              : $t("common.disconnected")
          }}
        </span>

        <div class="flex items-center gap-2 flex-wrap">
          <Button
            v-for="command of availableCommands"
            :key="command.value"
            size="sm"
            :variant="command.confirm ? 'destructive' : 'default'"
            :disabled="!match.is_server_online"
            @click="runCommand(command, send)"
          >
            {{ command.display }}
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          class="ml-auto"
          @click="expanded = !expanded"
        >
          <component
            :is="expanded ? ChevronDown : ChevronUp"
            class="w-4 h-4 mr-1"
          />
          {{ expanded ? $t("common.close") : $t("common.more") }}
        </Button>
      </div>

      <div
        v-if="expanded"
        class="border-t max-h-[60vh] overflow-auto px-4 py-4 flex flex-col gap-4"
      >
        <form
          v-if="restorableRounds.length > 0"
          @submit.prevent="send('restore_round', form.values.round)"
          class="flex flex-col gap-3"
        >
          <FormField v-slot="{ componentField }" name="round">
            <FormItem>
              <FormLabel>{{ $t("match.tabs.restore_round") }}</FormLabel>
              <Select
                v-bind="componentField"
                @update:model-value="
                  (value) => form.setFieldValue('round', value)
                "
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="$t('match.tabs.select_round_to_restore')"
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      v-for="round of restorableRounds"
                      :key="round.round"
                      :value="round.round.toString()"
                    >
                      {{
                        $t("common.round", { number: round.round.toString() })
                      }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button type="submit" class="w-fit">
            {{ $t("match.tabs.restore_round") }}
          </Button>
        </form>

        <div
          v-if="!hasLogs"
          class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center"
        >
          <h3 class="font-semibold">{{ $t("match.tabs.no_logs_title") }}</h3>
          <p class="text-sm text-muted-foreground">
            {{ $t("match.tabs.no_logs_description") }}
          </p>
        </div>
        <ServiceLogs
          v-show="hasLogs"
          :service="`m-${match.id}`"
          :compact="true"
          @has-logs="hasLogs = $event"
        />
      </div>
    </RconCommander>

    <div v-else class="flex items-center gap-2 px-4 py-2 flex-wrap">
      <div
        class="inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase border border-border rounded bg-muted/40 text-muted-foreground"
      >
        <Shield class="w-3 h-3" />
        Admin
      </div>
      <Button
        size="sm"
        variant="outline"
        class="ml-auto"
        @click="expanded = !expanded"
      >
        <component
          :is="expanded ? ChevronDown : ChevronUp"
          class="w-4 h-4 mr-1"
        />
        {{ expanded ? $t("common.close") : $t("common.more") }}
      </Button>

      <div
        v-if="expanded"
        class="basis-full border-t max-h-[60vh] overflow-auto mt-2 pt-4 flex flex-col gap-4"
      >
        <div
          v-if="!hasLogs"
          class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center"
        >
          <h3 class="font-semibold">{{ $t("match.tabs.no_logs_title") }}</h3>
          <p class="text-sm text-muted-foreground">
            {{ $t("match.tabs.no_logs_description") }}
          </p>
        </div>
        <ServiceLogs
          v-show="hasLogs"
          :service="`m-${match.id}`"
          :compact="true"
          @has-logs="hasLogs = $event"
        />
      </div>
    </div>
  </div>
</template>
