<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Fold } from "~/components/ui/transitions";
import { CircleAlert, Info, TriangleAlert } from "lucide-vue-next";
import {
  cpuFrequency,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  cpuThreads,
  warningInfo,
} from "~/components/game-server-nodes/nodeInspector";
import {
  INSPECTOR,
  warningTitle,
} from "~/components/game-server-nodes/nodeCopy";
import { TONE_TEXT } from "~/components/admin/tone";

// Hardware: the CPU on one line, its facts in a grid with the docs a tap
// away, then the GPU's model and anything the node warned about (a short
// line each, its docs a link, its text under Details).
const props = defineProps<{ node: NodeLike & Record<string, any> }>();

const { t } = useI18n();

// lscpu's raw line can arrive with its "Model name:" label still on.
const model = computed(() =>
  String(props.node.cpu_frequency_info?.model ?? "")
    .replace(/^\s*model name\s*:\s*/i, "")
    .trim(),
);
const pending = computed(
  () =>
    props.node.status === "Setup" ||
    (!model.value && !props.node.cpu_cores_per_socket),
);
const ghz = computed(() => cpuFrequency(props.node));
const slow = computed(() => !!ghz.value && ghz.value < 3);
// Some kernels report "N/A" when there's no cpufreq driver; that is unknown,
// not a misconfiguration.
const governor = computed(() => {
  const value = props.node.cpu_governor_info?.governor ?? null;
  return value && !/^(n\/?a|unknown|none)$/i.test(String(value).trim())
    ? value
    : null;
});
const governorTone = computed(() =>
  !governor.value
    ? "text-muted-foreground/70"
    : governor.value === "performance"
      ? ""
      : governor.value === "powersave"
        ? TONE_TEXT.bad
        : TONE_TEXT.warn,
);
const threads = computed(() => cpuThreads(props.node));

const formatMemory = (mb: number) => {
  if (!mb) {
    return "";
  }
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
};

const gpus = computed(() =>
  (Array.isArray(props.node.gpu_info) ? props.node.gpu_info : [])
    .filter((device: any) => device && typeof device === "object")
    .map((device: any) =>
      [
        device.name,
        device.memory_mb ? `(${formatMemory(device.memory_mb)})` : "",
      ]
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean),
);

const warnings = computed(() =>
  (props.node.cpu_warnings ?? []).map((text: string) => {
    const info = warningInfo(text);
    return { ...info, short: warningTitle(info, t) };
  }),
);
const warningOpen = ref<Record<number, boolean>>({});
const toggleWarning = (index: number) =>
  (warningOpen.value = {
    ...warningOpen.value,
    [index]: !warningOpen.value[index],
  });

const docs = {
  governor: "https://docs.5stack.gg/servers/cpu-governance",
  latency: "https://docs.5stack.gg/servers/low-latency-kernel",
  pinning: "https://docs.5stack.gg/servers/cpu-pinning",
};
</script>

<template>
  <section class="grid gap-2.5 p-4">
    <h3 class="text-[13px] font-semibold">{{ t("game_server.hardware") }}</h3>

    <p v-if="pending" class="text-xs text-muted-foreground">
      {{ t("pages.game_server_nodes.detail.hardware_pending") }}
    </p>

    <template v-else>
      <div v-if="model" class="truncate text-[13px]" :title="model">
        {{ model }}
      </div>

      <div class="gsn-facts mb-1 mt-0.5 grid grid-cols-3 gap-x-3.5 gap-y-3">
        <div class="gsn-fact">
          <span class="gsn-fk">{{ t("game_server.cpu_speed") }}</span>
          <FiveStackToolTip
            v-if="slow"
            as-child
            :delay-duration="120"
            align="start"
          >
            <template #trigger>
              <span
                class="gsn-fv inline-flex items-center gap-1"
                :class="TONE_TEXT.bad"
                tabindex="0"
              >
                <CircleAlert class="h-3 w-3" />{{ ghz?.toFixed(2) }} GHz
              </span>
            </template>
            {{ t(`${INSPECTOR}.attention.cpu`) }}
          </FiveStackToolTip>
          <span v-else class="gsn-fv">{{
            ghz ? `${ghz.toFixed(2)} GHz` : "—"
          }}</span>
        </div>

        <div class="gsn-fact">
          <span class="gsn-fk">{{ t(`${INSPECTOR}.hardware.cores`) }}</span>
          <span class="gsn-fv"
            >{{ node.cpu_cores_per_socket || "—" }}
            <small v-if="node.cpu_sockets">{{
              t(
                `${INSPECTOR}.hardware.sockets`,
                { count: node.cpu_sockets },
                node.cpu_sockets,
              )
            }}</small></span
          >
        </div>

        <div class="gsn-fact">
          <span class="gsn-fk">{{ t(`${INSPECTOR}.hardware.threads`) }}</span>
          <span class="gsn-fv"
            >{{ node.cpu_threads_per_core || "—" }}
            <small v-if="threads">{{
              t(`${INSPECTOR}.hardware.threads_total`, { count: threads })
            }}</small></span
          >
        </div>

        <div class="gsn-fact">
          <span class="gsn-fk">
            {{ t(`${INSPECTOR}.hardware.governor`) }}
            <FiveStackToolTip as-child :delay-duration="120" align="start">
              <template #trigger>
                <a
                  class="gsn-info"
                  :href="docs.governor"
                  target="_blank"
                  rel="noopener"
                  :aria-label="t(`${INSPECTOR}.hardware.governor_tip`)"
                  ><Info class="h-3 w-3"
                /></a>
              </template>
              <span class="block max-w-[16rem]">{{
                t(`${INSPECTOR}.hardware.governor_tip`)
              }}</span>
            </FiveStackToolTip>
          </span>
          <span class="gsn-fv capitalize" :class="governorTone">{{
            governor || t("common.na")
          }}</span>
        </div>

        <div class="gsn-fact">
          <span class="gsn-fk">
            {{ t(`${INSPECTOR}.hardware.low_latency`) }}
            <FiveStackToolTip as-child :delay-duration="120">
              <template #trigger>
                <a
                  class="gsn-info"
                  :href="docs.latency"
                  target="_blank"
                  rel="noopener"
                  :aria-label="t(`${INSPECTOR}.hardware.latency_tip`)"
                  ><Info class="h-3 w-3"
                /></a>
              </template>
              <span class="block max-w-[16rem]">{{
                t(`${INSPECTOR}.hardware.latency_tip`)
              }}</span>
            </FiveStackToolTip>
          </span>
          <span
            class="gsn-fv"
            :class="
              node.supports_low_latency
                ? 'text-success'
                : 'text-muted-foreground/70'
            "
            >{{
              node.supports_low_latency ? t("common.yes") : t("common.no")
            }}</span
          >
        </div>

        <div class="gsn-fact">
          <span class="gsn-fk">
            {{ t(`${INSPECTOR}.hardware.pinning`) }}
            <FiveStackToolTip as-child :delay-duration="120" align="end">
              <template #trigger>
                <a
                  class="gsn-info"
                  :href="docs.pinning"
                  target="_blank"
                  rel="noopener"
                  :aria-label="t(`${INSPECTOR}.hardware.pinning_tip`)"
                  ><Info class="h-3 w-3"
                /></a>
              </template>
              <span class="block max-w-[16rem]">{{
                t(`${INSPECTOR}.hardware.pinning_tip`)
              }}</span>
            </FiveStackToolTip>
          </span>
          <span
            class="gsn-fv"
            :class="
              node.supports_cpu_pinning
                ? 'text-success'
                : 'text-muted-foreground/70'
            "
            >{{
              node.supports_cpu_pinning
                ? t(`${INSPECTOR}.hardware.supported`)
                : t("common.no")
            }}</span
          >
        </div>
      </div>

      <!-- Disk has its own block and GPUs their own section; only a GPU's
           full model name adds anything here. -->
      <div v-if="gpus.length" class="gsn-kv">
        <span class="gsn-k">GPU</span>
        <div class="gsn-v">
          <span>{{ gpus.join(", ") }}</span>
        </div>
      </div>

      <div
        v-if="warnings.length"
        class="grid gap-0.5 border-t border-border/60 pt-2"
      >
        <span class="mb-0.5 text-[11.5px] text-muted-foreground">{{
          t(
            `${INSPECTOR}.warning.from_node`,
            { count: warnings.length },
            warnings.length,
          )
        }}</span>
        <div v-for="(warning, index) of warnings" :key="index">
          <div class="flex min-h-7 min-w-0 items-center gap-2 text-[13px]">
            <TriangleAlert class="h-3 w-3 shrink-0" :class="TONE_TEXT.warn" />
            <span
              class="min-w-0 truncate font-semibold"
              :class="TONE_TEXT.warn"
              :title="warning.short"
              >{{ warning.short }}</span
            >
            <span class="grow"></span>
            <a
              v-if="warning.url"
              :href="warning.url"
              target="_blank"
              rel="noopener"
              class="gsn-link"
              >{{ t(`${INSPECTOR}.warning.docs`) }}</a
            >
            <button
              type="button"
              class="gsn-link"
              :aria-expanded="!!warningOpen[index]"
              @click="toggleWarning(index)"
            >
              {{ t(`${INSPECTOR}.warning.details`) }}
            </button>
          </div>
          <Fold :open="!!warningOpen[index]">
            <p class="pb-1.5 pl-5 text-xs leading-normal text-muted-foreground">
              {{ warning.body }}
            </p>
          </Fold>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.gsn-fact {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.gsn-fk {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}
.gsn-fv {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.gsn-fv small {
  font-size: 11.5px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}
.gsn-info {
  display: inline-grid;
  color: hsl(240 4% 46%);
  transition: color 150ms ease;
}
.gsn-info:hover {
  color: hsl(var(--foreground));
}
.gsn-link {
  flex: none;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  transition: color 150ms ease;
}
.gsn-link:hover {
  color: hsl(var(--foreground));
}
/* Two facts to a row in the wide panel's narrower column. */
@container (max-width: 340px) {
  .gsn-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
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
</style>
