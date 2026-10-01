<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowRight, Check, TriangleAlert, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { toast } from "@/components/ui/toast";
import {
  CANCEL_DEDICATED_SERVER_MOVE_MUTATION,
  SERVER_MIGRATION_OPTIONAL,
} from "~/graphql/serverMigrationGraphql";
import {
  ACTIVE_SERVER_MIGRATION_STATUSES,
  CANCELABLE_SERVER_MIGRATION_STATUSES,
  formatBytes,
  type ServerMigrationRow,
} from "~/types/serverMigration";

const props = defineProps<{
  serverId: string;
  migration: ServerMigrationRow;
}>();

const emit = defineEmits<{ dismiss: [] }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

const STEPS = ["Queued", "Stopping", "Transferring", "Finalizing"];

const TONES = {
  active: {
    pill: "border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]",
    dot: "bg-[hsl(var(--tac-amber))]",
    rail: "bg-[hsl(var(--tac-amber))]",
  },
  success: {
    pill: "border-[hsl(var(--success)/0.5)] bg-[hsl(var(--success)/0.12)] text-success",
    dot: "bg-success",
    rail: "bg-success",
  },
  destructive: {
    pill: "border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.12)] text-destructive",
    dot: "bg-destructive",
    rail: "bg-destructive",
  },
  muted: {
    pill: "border-border/70 bg-muted/35 text-muted-foreground",
    dot: "bg-muted-foreground/60",
    rail: "bg-muted-foreground/40",
  },
};

const cardClasses =
  "relative isolate overflow-hidden rounded-lg border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.2)_0%,hsl(var(--card)/0.04)_100%)]";

const pillClasses =
  "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase leading-none tracking-[0.12em]";

const microLabelClasses =
  "font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground";

const active = computed(() =>
  ACTIVE_SERVER_MIGRATION_STATUSES.includes(props.migration.status),
);

const cancelable = computed(() =>
  CANCELABLE_SERVER_MIGRATION_STATUSES.includes(props.migration.status),
);

const tone = computed(() => {
  switch (props.migration.status) {
    case "Completed":
      return TONES.success;
    case "Failed":
      return TONES.destructive;
    case "Canceled":
      return TONES.muted;
    default:
      return TONES.active;
  }
});

const from = computed(
  () =>
    props.migration.from_game_server_node?.label ||
    props.migration.from_game_server_node?.id ||
    "?",
);

const to = computed(
  () =>
    props.migration.to_game_server_node?.label ||
    props.migration.to_game_server_node?.id ||
    "?",
);

const stepIndex = computed(() => STEPS.indexOf(props.migration.status));

const showProgress = computed(
  () =>
    props.migration.with_files &&
    Number(props.migration.bytes_total ?? 0) > 0 &&
    (props.migration.status === "Transferring" ||
      props.migration.status === "Finalizing"),
);

const percent = computed(() => {
  const total = Number(props.migration.bytes_total ?? 0);

  if (!total) {
    return 0;
  }

  const done = Math.min(
    99,
    Math.floor((Number(props.migration.bytes_done) / total) * 100),
  );

  return props.migration.status === "Finalizing" ? 100 : done;
});

const warnings = computed(() =>
  Array.isArray(props.migration.warnings) ? props.migration.warnings : [],
);

async function cancel() {
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: CANCEL_DEDICATED_SERVER_MOVE_MUTATION,
      variables: { server_id: props.serverId },
      context: SERVER_MIGRATION_OPTIONAL,
    });

    toast({
      title: t("pages.dedicated_servers.detail.migration.cancel_requested"),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description:
        error?.graphQLErrors?.[0]?.message ||
        error?.message ||
        t("common.error"),
    });
  }
}
</script>

<template>
  <section>
    <div class="mb-3 flex items-center gap-3">
      <div
        class="inline-flex min-w-0 items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        <span class="h-[2px] w-[10px] shrink-0 bg-[hsl(var(--tac-amber))]"></span>
        <span class="truncate">
          {{
            $t(
              `pages.dedicated_servers.detail.migration.title.${active ? "active" : migration.status}`,
              { node: to },
            )
          }}
        </span>
      </div>
      <span class="h-px flex-1 bg-border" />
      <span :class="[pillClasses, tone.pill]">
        <span
          class="h-1 w-1 rounded-full"
          :class="[tone.dot, active && 'animate-pulse motion-reduce:animate-none']"
        />
        {{
          $t(`pages.dedicated_servers.detail.migration.status.${migration.status}`)
        }}
      </span>
      <Button
        v-if="!active"
        variant="ghost"
        size="icon-sm"
        class="shrink-0 [&_svg]:size-3.5"
        :aria-label="$t('pages.dedicated_servers.detail.migration.dismiss')"
        @click="emit('dismiss')"
      >
        <X />
      </Button>
    </div>

    <div :class="cardClasses">
      <span
        class="absolute inset-y-2 left-0 w-[2px] rounded-full"
        :class="tone.rail"
        aria-hidden="true"
      />

      <div class="flex flex-col gap-4 p-4">
        <div
          class="flex flex-wrap items-center gap-2 font-mono text-[0.8rem] tracking-[0.05em] text-muted-foreground"
        >
          <span class="truncate text-foreground">{{ from }}</span>
          <ArrowRight class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
          <span class="truncate text-foreground">{{ to }}</span>
          <span v-if="!migration.with_files" :class="microLabelClasses">
            · {{ $t("pages.dedicated_servers.detail.migration.without_files") }}
          </span>
        </div>

        <ol v-if="active" class="grid grid-cols-4 gap-1.5">
          <li
            v-for="(step, index) of STEPS"
            :key="step"
            class="flex min-w-0 items-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[0.58rem] font-bold uppercase leading-none tracking-[0.12em]"
            :class="
              index < stepIndex
                ? 'border-[hsl(var(--success)/0.4)] text-success'
                : index === stepIndex
                  ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]'
                  : 'border-border/70 bg-muted/35 text-muted-foreground'
            "
          >
            <Check v-if="index < stepIndex" class="h-3 w-3 shrink-0" />
            <span class="truncate">
              {{ $t(`pages.dedicated_servers.detail.migration.status.${step}`) }}
            </span>
          </li>
        </ol>

        <div v-if="showProgress" class="flex flex-col gap-1.5">
          <Progress :model-value="percent" class="h-1.5" />
          <span :class="microLabelClasses" class="tabular-nums">
            {{
              $t("pages.dedicated_servers.detail.migration.progress", {
                done: formatBytes(migration.bytes_done),
                total: formatBytes(migration.bytes_total),
                percent,
              })
            }}
          </span>
        </div>
        <div
          v-else-if="active"
          class="h-[3px] overflow-hidden rounded bg-muted text-[hsl(var(--tac-amber))]"
          aria-hidden="true"
        >
          <div class="tac-scan-sweep h-full" />
        </div>

        <div
          v-if="migration.status === 'Failed' || migration.status === 'Canceled'"
          class="flex items-start gap-2.5 rounded-md border px-3 py-2.5"
          :class="
            migration.status === 'Failed'
              ? 'border-destructive/40 bg-destructive/10'
              : 'border-border bg-foreground/5'
          "
        >
          <TriangleAlert
            class="mt-0.5 h-3.5 w-3.5 shrink-0"
            :class="
              migration.status === 'Failed'
                ? 'text-destructive'
                : 'text-muted-foreground'
            "
            aria-hidden="true"
          />
          <div class="min-w-0 space-y-1 text-xs leading-relaxed">
            <p
              v-if="migration.status === 'Failed' && migration.error"
              class="break-words text-destructive"
            >
              {{ migration.error }}
            </p>
            <p class="text-muted-foreground">
              {{
                $t("pages.dedicated_servers.detail.migration.restored", {
                  node: from,
                })
              }}
            </p>
          </div>
        </div>

        <ul
          v-if="warnings.length"
          class="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground"
        >
          <li v-for="warning of warnings" :key="warning" class="flex gap-2">
            <span
              class="mt-[0.45rem] h-[2px] w-[8px] shrink-0 bg-[hsl(var(--tac-amber))]"
            ></span>
            {{ warning }}
          </li>
        </ul>
      </div>

      <div
        v-if="cancelable"
        class="flex justify-end border-t border-border/60 px-4 py-3"
      >
        <Button variant="outline" size="sm" @click="cancel">
          <X />
          {{ $t("pages.dedicated_servers.detail.migration.cancel") }}
        </Button>
      </div>
    </div>
  </section>
</template>
