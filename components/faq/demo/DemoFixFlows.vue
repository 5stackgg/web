<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Server } from "lucide-vue-next";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import { DEMO_LINEUPS } from "~/utilities/demoMatch";

const props = defineProps<{ series: [number, number] }>();

const flow = defineModel<string | null>("flow", { default: null });

const { t } = useI18n();

const picked = ref<1 | 2 | null>(null);
const choice = ref<"replay" | "swap">("replay");

watch(flow, () => {
  picked.value = null;
  choice.value = "replay";
});

const open = computed({
  get: () => flow.value !== null,
  set: (value: boolean) => {
    if (!value) {
      flow.value = null;
    }
  },
});

type Flow = {
  title: string;
  description: string;
  confirm: string;
  done: string;
  destructive?: boolean;
  picker?: "team";
  lines?: string[];
  icon?: boolean;
};

const flows = computed<Record<string, Flow>>(() => ({
  restart_map: {
    title: t("match.recovery.restart_map.title"),
    description: t("match.recovery.restart_map.description"),
    confirm: t("match.recovery.restart_map.title"),
    done: t("match.recovery.restart_map.restarted"),
    destructive: true,
  },
  restart: {
    title: t("match.recovery.restart.title"),
    description: t("match.recovery.fix.description", {
      team_1: DEMO_LINEUPS[1].name,
      team_2: DEMO_LINEUPS[2].name,
    }),
    lines: [
      t("match.recovery.restart.reopen_live"),
      t("match.recovery.restart.reopen_veto"),
    ],
    confirm: t("match.recovery.restart.title"),
    done: t("match.recovery.restart.restarted"),
    destructive: true,
  },
  replay: {
    title: t("match.recovery.restart.title"),
    description: t("match.recovery.fix.description", {
      team_1: DEMO_LINEUPS[1].name,
      team_2: DEMO_LINEUPS[2].name,
    }),
    confirm: t("match.recovery.restart.title"),
    done: t("match.recovery.restart.restarted"),
    destructive: true,
  },
  winner: {
    title: t("match.winner.set"),
    description: t("match.winner.set_hint"),
    confirm: t("match.winner.set"),
    done: t("faq.demo.winner_set"),
    picker: "team",
  },
  forfeit: {
    title: t("match.recovery.fix.forfeit_title"),
    description: t("faq.demo.forfeit_hint"),
    confirm: t("faq.demo.forfeit_confirm"),
    done: t("faq.demo.forfeit_done"),
    destructive: true,
    picker: "team",
  },
  server: {
    title: t("match.server.reboot_confirm_title"),
    description: t("match.server.reboot_confirm_description"),
    confirm: t("match.server.reboot"),
    done: t("match.server.reboot_started"),
    destructive: true,
    icon: true,
  },
}));

const current = computed(() => (flow.value ? flows.value[flow.value] : null));

const record = (lineup: 1 | 2) => {
  const won = props.series[lineup - 1];
  const lost = props.series[lineup === 1 ? 1 : 0];
  return t("match.winner.map_record", { won, lost });
};

function confirm() {
  if (!current.value) {
    return;
  }
  toast({
    title: current.value.done,
    description: t("faq.demo.nothing_changed"),
  });
  flow.value = null;
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent v-if="current" class="max-w-xl">
      <AlertDialogHeader>
        <div class="flex items-start gap-3.5">
          <span
            v-if="current.icon"
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive"
          >
            <Server class="size-[18px]" />
          </span>
          <div class="flex flex-col gap-1.5">
            <AlertDialogTitle>{{ current.title }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{ current.description }}
            </AlertDialogDescription>
          </div>
        </div>
      </AlertDialogHeader>

      <div
        v-if="current.lines"
        class="flex flex-col gap-2 rounded-lg bg-muted/30 px-3.5 py-3 text-sm"
      >
        <p v-for="line of current.lines" :key="line">{{ line }}</p>
      </div>

      <div
        v-if="flow === 'replay'"
        role="radiogroup"
        :aria-label="current.title"
        class="flex flex-col gap-2"
      >
        <label
          v-for="option in ['replay', 'swap'] as const"
          :key="option"
          class="grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] gap-3 rounded-lg border p-3.5 transition-colors duration-150 ease-out motion-reduce:transition-none"
          :class="
            choice === option
              ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.06)]'
              : 'border-border hover:border-[hsl(var(--tac-amber)/0.4)]'
          "
        >
          <input
            v-model="choice"
            type="radio"
            name="demo-restart-choice"
            :value="option"
            class="mt-0.5 accent-[hsl(var(--tac-amber))]"
          />
          <span class="flex flex-col gap-1">
            <span class="text-sm font-semibold">
              {{
                option === "replay"
                  ? $t("match.recovery.restart.replay_title")
                  : $t("match.recovery.restart.swap_title", {
                      team: DEMO_LINEUPS[2].name,
                    })
              }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{
                option === "replay"
                  ? $t("match.recovery.restart.replay_description")
                  : $t("match.recovery.restart.swap_description")
              }}
            </span>
          </span>
        </label>
      </div>

      <div
        v-if="current.picker === 'team'"
        class="grid grid-cols-2 gap-2"
        role="radiogroup"
        :aria-label="current.title"
      >
        <button
          v-for="lineup in [1, 2] as const"
          :key="lineup"
          type="button"
          role="radio"
          :aria-checked="picked === lineup"
          class="grid min-w-0 content-start gap-2.5 rounded-md border p-3 text-left transition-colors duration-200 ease-out"
          :class="
            picked === lineup
              ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)]'
              : 'border-border hover:bg-muted/40'
          "
          @click="picked = lineup"
        >
          <span class="flex min-w-0 items-center gap-2.5">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-[0.65rem] font-extrabold tracking-wide text-foreground/85 ring-1 ring-inset ring-white/10"
            >
              {{ DEMO_LINEUPS[lineup].tag }}
            </span>
            <span class="grid min-w-0 gap-0.5">
              <span class="truncate text-sm font-semibold">
                {{ DEMO_LINEUPS[lineup].name }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ record(lineup) }}
              </span>
            </span>
          </span>
        </button>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <Button
          :variant="current.destructive ? 'destructive' : 'default'"
          :disabled="current.picker === 'team' && !picked"
          @click="confirm"
        >
          {{
            flow === "replay" && choice === "swap"
              ? $t("match.recovery.restart.swap_confirm")
              : current.confirm
          }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
