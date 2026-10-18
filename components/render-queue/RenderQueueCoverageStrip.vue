<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useNuxtApp } from "#app";
import { Clapperboard } from "lucide-vue-next";
import { renderUtilityLineupPreviewsMutation } from "~/graphql/utilityRenderGraphql";
import UtilityRenderCoverage from "~/components/utility/UtilityRenderCoverage.vue";
import UtilityRenderWarn from "~/components/utility/UtilityRenderWarn.vue";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { toast } from "~/components/ui/toast";
import { useUtilityRenderCoverage } from "~/composables/useUtilityRenderCoverage";
import { TONE_TEXT } from "~/components/admin/tone";
import type { UtilityRenderCoverage as Coverage } from "~/types/utility";

type BulkScope = "missing" | "outdated";

const props = defineProps<{
  coverage: Coverage | null;
  failed?: boolean;
}>();

const emit = defineEmits<{ (e: "enqueued"): void }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

const stats = computed(() =>
  props.coverage
    ? ([
        { key: "current", value: props.coverage.current, tone: "" },
        {
          key: "missing",
          value: props.coverage.missing,
          tone: props.coverage.missing ? TONE_TEXT.bad : "",
        },
        {
          key: "outdated",
          value: props.coverage.outdated,
          tone: props.coverage.outdated ? TONE_TEXT.warn : "",
        },
        { key: "unrenderable", value: props.coverage.unrenderable, tone: "" },
        { key: "queued", value: props.coverage.queued, tone: "" },
      ] as const)
    : [],
);

const confirming = ref<BulkScope | null>(null);
// The dialog keeps its words while it closes.
const asked = ref<BulkScope>("missing");
const queueing = ref(false);

function ask(scope: BulkScope) {
  asked.value = scope;
  confirming.value = scope;
}

async function queue() {
  const scope = confirming.value;
  if (!scope || queueing.value) {
    return;
  }
  queueing.value = true;
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: renderUtilityLineupPreviewsMutation,
      variables: { scope, map_name: null },
    });
    const result = (data as any)?.renderUtilityLineupPreviews;
    const queued = Number(result?.queued ?? 0);
    const skipped = Number(result?.skipped ?? 0);
    toast({
      title:
        queued > 0
          ? t(
              "pages.utility.render_queue.coverage.queued_toast",
              {
                count: queued,
              },
              queued,
            )
          : t("pages.utility.render_queue.coverage.none_toast"),
      description:
        skipped > 0
          ? t(
              "pages.utility.render_queue.coverage.left_toast",
              { count: skipped },
              skipped,
            )
          : undefined,
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.render_queue.coverage.failed_toast"),
      description: error?.graphQLErrors?.[0]?.message ?? error?.message,
      variant: "destructive",
    });
  } finally {
    queueing.value = false;
    confirming.value = null;
    emit("enqueued");
  }
}

// The lineup list gets its own coverage, so narrowing it to one map does not
// change the numbers on the strip.
const lineupsOpen = ref(false);
const {
  coverage: sheetCoverage,
  failed: sheetFailed,
  map: sheetMap,
  refresh: refreshSheet,
} = useUtilityRenderCoverage();

watch(lineupsOpen, (open) => {
  if (open) {
    void refreshSheet();
  }
});

function onSheetEnqueued() {
  void refreshSheet();
  emit("enqueued");
}
</script>

<template>
  <div
    data-render-coverage
    class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-lg border border-border bg-card/30 px-3 py-2.5 text-[0.8rem] text-muted-foreground"
  >
    <span class="inline-flex items-center gap-1.5">
      <Clapperboard class="h-3.5 w-3.5" />
      {{ $t("pages.utility.render_queue.coverage.title") }}
      <span v-if="coverage" class="font-mono text-xs text-foreground">
        v{{ coverage.version }}
      </span>
    </span>

    <i18n-t
      v-for="stat of stats"
      :key="stat.key"
      :keypath="`pages.render_queue.ledger.coverage.${stat.key}`"
      tag="span"
      :data-coverage-stat="stat.key"
    >
      <template #count>
        <b
          class="font-semibold tabular-nums text-foreground"
          :class="stat.tone"
        >
          {{ stat.value }}
        </b>
      </template>
    </i18n-t>

    <UtilityRenderWarn
      v-if="failed"
      :title="$t('pages.utility.render_queue.coverage.load_failed')"
    />

    <span class="flex-1" />

    <button
      type="button"
      class="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      @click="lineupsOpen = true"
    >
      {{ $t("pages.render_queue.ledger.coverage.lineups") }}
    </button>
    <Button
      size="sm"
      variant="outline"
      class="h-7"
      data-bulk="outdated"
      :disabled="!coverage?.outdated"
      @click="ask('outdated')"
    >
      {{ $t("pages.render_queue.ledger.coverage.rerender_outdated") }}
    </Button>
    <Button
      size="sm"
      variant="outline"
      class="h-7"
      data-bulk="missing"
      :disabled="!coverage?.missing"
      @click="ask('missing')"
    >
      {{ $t("pages.render_queue.ledger.coverage.render_missing") }}
    </Button>
  </div>

  <AlertDialog
    :open="confirming !== null"
    @update:open="(open) => !open && (confirming = null)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ $t(`pages.render_queue.ledger.coverage.confirm_${asked}_title`) }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{
            $t(
              `pages.utility.render_queue.coverage.confirm_${asked}`,
              { count: coverage?.[asked] ?? 0 },
              coverage?.[asked] ?? 0,
            )
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <!-- Not AlertDialogAction, which closes before the mutation ran. -->
        <Button
          data-bulk-confirm
          class="bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
          :loading="queueing"
          @click="queue"
        >
          {{ $t("pages.render_queue.ledger.coverage.confirm_queue") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <Sheet v-model:open="lineupsOpen">
    <SheetContent class="w-full overflow-y-auto sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle>
          {{ $t("pages.render_queue.ledger.coverage.lineups_title") }}
        </SheetTitle>
        <SheetDescription v-if="coverage">
          {{
            $t("pages.render_queue.ledger.coverage.lineups_sub", {
              version: coverage.version,
            })
          }}
        </SheetDescription>
      </SheetHeader>
      <div class="py-5">
        <UtilityRenderCoverage
          v-model:map="sheetMap"
          :coverage="sheetCoverage"
          :failed="sheetFailed"
          @enqueued="onSheetEnqueued"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>
