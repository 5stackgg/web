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
    border: "border-[hsl(var(--tac-amber)/0.35)]",
    dot: "bg-[hsl(var(--tac-amber))]",
    text: "text-[hsl(var(--tac-amber))]",
  },
  success: {
    border: "border-[hsl(var(--success)/0.35)]",
    dot: "bg-success",
    text: "text-success",
  },
  destructive: {
    border: "border-destructive/35",
    dot: "bg-destructive",
    text: "text-destructive",
  },
  muted: {
    border: "border-border",
    dot: "bg-muted-foreground/60",
    text: "text-muted-foreground",
  },
};

const statusWord = (status: string) =>
  t(`pages.dedicated_servers.detail.migration.status.${status}`);

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
  <section
    class="grid gap-3 rounded-md border bg-[hsl(240_5%_8%)] px-3.5 py-3"
    :class="tone.border"
    role="status"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span class="size-2 shrink-0 rounded-full" :class="tone.dot" />
      <p class="min-w-0 flex-1 truncate text-sm font-semibold">
        {{
          $t(
            `pages.dedicated_servers.detail.migration.title.${active ? "active" : migration.status}`,
            { node: to },
          )
        }}
      </p>
      <span class="shrink-0 text-xs" :class="tone.text">
        {{ statusWord(migration.status) }}
      </span>
      <Button
        v-if="!active"
        variant="ghost"
        size="icon-sm"
        class="-my-1 shrink-0 text-muted-foreground [&_svg]:size-3.5"
        :aria-label="$t('pages.dedicated_servers.detail.migration.dismiss')"
        @click="emit('dismiss')"
      >
        <X />
      </Button>
    </div>

    <div
      class="-mt-2 flex min-w-0 flex-wrap items-center gap-1.5 pl-[1.125rem] text-xs text-muted-foreground"
    >
      <span class="truncate font-mono text-foreground/90">{{ from }}</span>
      <ArrowRight class="size-3 shrink-0" />
      <span class="truncate font-mono text-foreground/90">{{ to }}</span>
      <span v-if="!migration.with_files">
        · {{ $t("pages.dedicated_servers.detail.migration.without_files") }}
      </span>
    </div>

    <ol v-if="active" class="grid grid-cols-4 gap-2 pl-[1.125rem]">
      <li
        v-for="(step, index) of STEPS"
        :key="step"
        class="grid min-w-0 gap-1.5 text-[11px]"
        :class="
          index < stepIndex
            ? 'text-muted-foreground'
            : index === stepIndex
              ? 'text-foreground'
              : 'text-muted-foreground/60'
        "
      >
        <span
          class="h-0.5 rounded-full transition-colors duration-150"
          :class="
            index < stepIndex
              ? 'bg-success'
              : index === stepIndex
                ? 'bg-[hsl(var(--tac-amber))]'
                : 'bg-muted'
          "
          aria-hidden="true"
        />
        <span class="inline-flex min-w-0 items-center gap-1">
          <Check
            v-if="index < stepIndex"
            class="size-3 shrink-0 text-success"
          />
          <span class="truncate">{{ statusWord(step) }}</span>
        </span>
      </li>
    </ol>

    <div v-if="showProgress" class="grid gap-1.5 pl-[1.125rem]">
      <Progress :model-value="percent" class="h-1.5" />
      <span class="text-xs tabular-nums text-muted-foreground">
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
      class="ml-[1.125rem] h-[3px] overflow-hidden rounded bg-muted text-[hsl(var(--tac-amber))]"
      aria-hidden="true"
    >
      <div class="tac-scan-sweep h-full" />
    </div>

    <div
      v-if="migration.status === 'Failed' || migration.status === 'Canceled'"
      class="flex items-start gap-2 pl-[1.125rem] text-xs leading-relaxed"
    >
      <TriangleAlert
        class="mt-0.5 size-3.5 shrink-0"
        :class="
          migration.status === 'Failed'
            ? 'text-destructive'
            : 'text-muted-foreground'
        "
        aria-hidden="true"
      />
      <div class="min-w-0 space-y-1">
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
      class="grid gap-1 pl-[1.125rem] text-xs leading-relaxed text-muted-foreground"
    >
      <li v-for="warning of warnings" :key="warning" class="flex gap-2">
        <TriangleAlert class="mt-0.5 size-3 shrink-0 text-warning" />
        {{ warning }}
      </li>
    </ul>

    <div v-if="cancelable" class="flex justify-end">
      <Button variant="outline" size="sm" class="h-8" @click="cancel">
        <X class="size-3.5" />
        {{ $t("pages.dedicated_servers.detail.migration.cancel_move") }}
      </Button>
    </div>
  </section>
</template>
