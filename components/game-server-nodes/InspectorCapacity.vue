<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Fold } from "~/components/ui/transitions";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import TweenNumber from "~/components/game-server-nodes/TweenNumber.vue";
import InspectorLabel from "~/components/game-server-nodes/InspectorLabel.vue";
import NodeMeter from "~/components/game-server-nodes/NodeMeter.vue";
import { CircleAlert } from "lucide-vue-next";
import {
  hasPorts,
  isGpuOnly,
  isOffline,
  isOverprovisioned,
  type CpuPinning,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  cpuThreads,
  portsError,
  serversFit,
} from "~/components/game-server-nodes/nodeInspector";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { TONE_TEXT } from "~/components/admin/tone";

// Capacity: region, the port range with its inline editor, how full the node
// is and how many servers its CPU has room for.
const props = defineProps<{
  node: NodeLike;
  region: string | null;
  serverRegions: Array<{ value: string; description?: string | null }>;
  maxServers: number;
  pinning: CpuPinning;
  portsOpen: boolean;
}>();

const emit = defineEmits<{
  "update:portsOpen": [open: boolean];
  region: [region: string | null];
  savePorts: [start: number, end: number];
  clearPorts: [];
}>();

const { t } = useI18n();

const valClasses =
  "-ml-2 h-7 w-auto min-w-0 max-w-full gap-1.5 border-transparent bg-transparent px-2 py-0 text-[13px] shadow-none transition-colors hover:border-border hover:bg-muted/40 focus:ring-0 focus-visible:ring-1 data-[state=open]:border-border";

const gpuOnly = computed(() => isGpuOnly(props.node));
const inSetup = computed(() => props.node.status === "Setup");
const ports = computed(() =>
  hasPorts(props.node)
    ? `${props.node.start_port_range}–${props.node.end_port_range}`
    : "",
);
const threads = computed(() => cpuThreads(props.node));
const overprovisioned = computed(() =>
  isOverprovisioned(props.node, props.maxServers),
);
const total = computed(() => props.node.total_server_count ?? 0);
const used = computed(() =>
  Math.max(0, total.value - (props.node.available_server_count ?? 0)),
);

const servers = computed(() => {
  if (inSetup.value) {
    return "none";
  }
  if (!hasPorts(props.node)) {
    return "no_ports";
  }
  if (!props.node.enabled) {
    return "disabled";
  }
  return isOffline(props.node) ? "offline" : "free";
});

const maxTip = computed(() => {
  if (!threads.value) {
    return t(`${INSPECTOR}.capacity.max_tip_pending`);
  }
  return props.pinning.enabled && props.node.supports_cpu_pinning
    ? t(`${INSPECTOR}.capacity.max_tip_pinning`, {
        threads: threads.value,
        per: props.pinning.cpusPerServer,
      })
    : t(`${INSPECTOR}.capacity.max_tip`, { threads: threads.value });
});

// The inline ports editor.
const start = ref<number | null>(null);
const end = ref<number | null>(null);
const tried = ref(false);
const startInput = ref<InstanceType<typeof Input> | null>(null);

watch(
  () => props.portsOpen,
  (open) => {
    if (!open) {
      return;
    }
    start.value = props.node.start_port_range ?? null;
    end.value = props.node.end_port_range ?? null;
    tried.value = false;
    nextTick(() => {
      const el = (startInput.value as any)?.$el as HTMLInputElement | undefined;
      el?.focus({ preventScroll: true });
      el?.closest(".gsn-ports")?.scrollIntoView({ block: "nearest" });
    });
  },
  { immediate: true },
);

const portsMessage = computed(() => {
  const s = Number(start.value) || 0;
  const e = Number(end.value) || 0;
  if (!s || !e) {
    return tried.value
      ? { tone: "bad" as const, text: t(`${INSPECTOR}.ports.error_range`) }
      : { tone: null, text: t(`${INSPECTOR}.ports.hint`) };
  }
  const error = portsError(s, e);
  if (error) {
    return {
      tone: "bad" as const,
      text: t(`${INSPECTOR}.ports.error_${error}`),
    };
  }
  const fit = serversFit(s, e);
  if (threads.value && fit > props.maxServers) {
    return {
      tone: "warn" as const,
      text: t(`${INSPECTOR}.ports.fit_over`, {
        count: fit,
        max: props.maxServers,
      }),
    };
  }
  return {
    tone: null,
    text: t(`${INSPECTOR}.ports.fit`, { count: fit }, fit),
  };
});

function save() {
  tried.value = true;
  const s = Number(start.value) || 0;
  const e = Number(end.value) || 0;
  if (portsError(s, e)) {
    return;
  }
  emit("savePorts", s, e);
}

function onPortsKey(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    save();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("update:portsOpen", false);
  }
}
</script>

<template>
  <section class="grid gap-2.5 p-4">
    <InspectorLabel>{{
      t("pages.game_server_nodes.table.capacity")
    }}</InspectorLabel>

    <p v-if="gpuOnly" class="text-xs text-muted-foreground">
      {{ t(`${INSPECTOR}.capacity.gpu_only`) }}
    </p>

    <div v-else class="gsn-kv">
      <span class="gsn-k">{{ t("common.region") }}</span>
      <div class="gsn-v">
        <Select
          :model-value="region as any"
          @update:model-value="
            (value) => emit('region', (value as any) ?? null)
          "
        >
          <SelectTrigger :class="valClasses" :aria-label="t('common.region')">
            <SelectValue :placeholder="t('game_server.no_region')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="null as any">
                {{ t("game_server.no_region") }}
              </SelectItem>
              <SelectItem
                v-for="option of serverRegions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.description || option.value }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <span class="gsn-k">
        <FiveStackToolTip as-child :delay-duration="120" align="start">
          <template #trigger>
            <span
              class="cursor-help underline decoration-muted-foreground/60 decoration-dotted underline-offset-[3px]"
              tabindex="0"
              >{{ t("pages.game_server_nodes.table.ports") }}</span
            >
          </template>
          <span class="block max-w-[16rem]">{{
            t(`${INSPECTOR}.ports.tip`)
          }}</span>
        </FiveStackToolTip>
      </span>
      <div class="gsn-v">
        <span v-if="ports" class="font-mono text-xs tabular-nums">{{
          ports
        }}</span>
        <span v-else class="text-muted-foreground/70">{{
          t(`${INSPECTOR}.ports.not_set`)
        }}</span>
        <button
          type="button"
          class="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
          :aria-expanded="portsOpen"
          @click="emit('update:portsOpen', !portsOpen)"
        >
          {{ ports ? t("common.edit") : t(`${INSPECTOR}.step.set_ports`) }}
        </button>
      </div>

      <div class="col-span-full">
        <Fold :open="portsOpen">
          <div
            class="gsn-ports mb-1.5 mt-1 grid gap-2 rounded-lg border border-border/60 bg-[hsl(240_5%_8.5%)] px-3 py-2.5"
          >
            <template v-if="!region">
              <p class="text-xs text-muted-foreground">
                {{ t(`${INSPECTOR}.ports.need_region`) }}
              </p>
              <Select
                :model-value="region as any"
                @update:model-value="
                  (value) => emit('region', (value as any) ?? null)
                "
              >
                <SelectTrigger class="h-8 w-auto text-xs">
                  <SelectValue
                    :placeholder="t(`${INSPECTOR}.step.assign_region`)"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      v-for="option of serverRegions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.description || option.value }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </template>
            <template v-else>
              <div class="grid grid-cols-2 gap-2.5">
                <label class="grid gap-1">
                  <span class="text-xs text-muted-foreground">{{
                    t(`${INSPECTOR}.ports.start`)
                  }}</span>
                  <Input
                    ref="startInput"
                    v-model.number="start"
                    type="number"
                    inputmode="numeric"
                    :min="30000"
                    :max="32767"
                    :step="2"
                    placeholder="30000"
                    autocomplete="off"
                    class="h-8 font-mono text-sm"
                    @keydown="onPortsKey"
                  />
                </label>
                <label class="grid gap-1">
                  <span class="text-xs text-muted-foreground">{{
                    t(`${INSPECTOR}.ports.end`)
                  }}</span>
                  <Input
                    v-model.number="end"
                    type="number"
                    inputmode="numeric"
                    :min="30000"
                    :max="32767"
                    :step="2"
                    placeholder="30017"
                    autocomplete="off"
                    class="h-8 font-mono text-sm"
                    @keydown="onPortsKey"
                  />
                </label>
              </div>
              <p
                class="text-xs"
                :class="
                  portsMessage.tone
                    ? TONE_TEXT[portsMessage.tone]
                    : 'text-muted-foreground'
                "
                aria-live="polite"
              >
                {{ portsMessage.text }}
              </p>
              <div class="flex items-center gap-2">
                <Button size="sm" variant="outline" @click="save">
                  {{ t(`${INSPECTOR}.ports.save`) }}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  @click="emit('update:portsOpen', false)"
                >
                  {{ t("common.cancel") }}
                </Button>
                <span class="grow"></span>
                <button
                  v-if="ports"
                  type="button"
                  class="text-xs text-destructive underline decoration-destructive/50 decoration-dotted underline-offset-2"
                  @click="emit('clearPorts')"
                >
                  {{ t(`${INSPECTOR}.ports.remove`) }}
                </button>
              </div>
            </template>
          </div>
        </Fold>
      </div>

      <span class="gsn-k">{{
        t("pages.game_server_nodes.table.servers")
      }}</span>
      <div class="gsn-v">
        <span v-if="servers === 'none'" class="text-muted-foreground/60"
          >—</span
        >
        <span v-else-if="servers !== 'free'" class="text-muted-foreground/70">{{
          t(`${INSPECTOR}.capacity.servers_${servers}`)
        }}</span>
        <span v-else class="flex flex-wrap items-center gap-2.5">
          <i18n-t
            :keypath="`${INSPECTOR}.cap_free`"
            tag="span"
            scope="global"
            class="tabular-nums"
          >
            <template #free>
              <b class="font-semibold"
                ><TweenNumber :value="node.available_server_count ?? 0"
              /></b>
            </template>
            <template #total>{{ total }}</template>
          </i18n-t>
          <span
            v-if="total > 0 && total <= 48"
            class="flex h-[5px] w-32 gap-[2px]"
            aria-hidden="true"
          >
            <i
              v-for="index of total"
              :key="index"
              class="gsn-slot flex-1 rounded-[2px]"
              :data-on="index <= used"
            ></i>
          </span>
          <NodeMeter
            v-else-if="total > 48"
            class="w-32"
            :value="(used / total) * 100"
            tone="amber"
          />
        </span>
      </div>

      <span class="gsn-k">
        <FiveStackToolTip as-child :delay-duration="120" align="start">
          <template #trigger>
            <span
              class="cursor-help underline decoration-muted-foreground/60 decoration-dotted underline-offset-[3px]"
              tabindex="0"
              >{{ t(`${INSPECTOR}.capacity.max_servers`) }}</span
            >
          </template>
          <span class="block max-w-[16rem]">{{ maxTip }}</span>
        </FiveStackToolTip>
      </span>
      <div class="gsn-v">
        <span class="tabular-nums">{{
          inSetup || !threads ? "—" : maxServers
        }}</span>
        <span
          v-if="overprovisioned"
          class="inline-flex items-center gap-1 text-xs"
          :class="TONE_TEXT.bad"
        >
          <CircleAlert class="h-3 w-3" />
          {{ t(`${INSPECTOR}.capacity.below`, { total }) }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gsn-kv {
  display: grid;
  grid-template-columns: minmax(92px, 32%) minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 2px;
  font-size: 13px;
}
.gsn-k {
  color: hsl(var(--muted-foreground));
}
.gsn-v {
  display: flex;
  min-width: 0;
  min-height: 30px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.gsn-slot {
  background: hsl(240 4% 16%);
  transition: background-color 300ms ease;
}
.gsn-slot[data-on="true"] {
  background: hsl(var(--tac-amber));
}
@media (prefers-reduced-motion: reduce) {
  .gsn-slot {
    transition: none;
  }
}
</style>
