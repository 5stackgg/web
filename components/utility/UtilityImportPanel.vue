<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Eye, FileUp, Play, TriangleAlert, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { toast } from "~/components/ui/toast";
import UtilityConfidenceNote from "~/components/utility/UtilityConfidenceNote.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  importUtilityLineupsMutation,
  purgeUtilityLineupSourceMutation,
} from "~/graphql/utilityGraphql";
import {
  UTILITY_IMPORT_MAX_ENTRIES,
  readUtilityImportOutput,
  readUtilityPurgeOutput,
} from "~/types/utility";
import type {
  UtilityImportOutput,
  UtilityImportView,
  UtilityOriginSource,
  UtilityPurgeOutput,
  UtilityPurgeView,
} from "~/types/utility";

const { t } = useI18n();

// This panel is the import's own undo, so it only ever names the import source.
// The action takes any source in `e_utility_sources`, and offering that choice from
// here would put "delete everything the plugin recorded" one click from a
// payload box.
const PURGE_SOURCE: UtilityOriginSource = "import";

const payloadText = ref("");
const dryRun = ref<UtilityImportView | null>(null);
const applied = ref<UtilityImportView | null>(null);
const confirmPurge = ref(false);
const purgePreview = ref<UtilityPurgeView | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const parsed = computed<{ value: unknown; invalid: boolean }>(() => {
  const text = payloadText.value.trim();
  if (!text) {
    return { value: null, invalid: false };
  }
  try {
    return { value: JSON.parse(text), invalid: false };
  } catch {
    return { value: null, invalid: true };
  }
});

const hasPayload = computed(
  () => !!payloadText.value.trim() && !parsed.value.invalid,
);

const entryCount = computed(() =>
  Array.isArray(parsed.value.value) ? parsed.value.value.length : null,
);

const tooManyEntries = computed(
  () => (entryCount.value ?? 0) > UTILITY_IMPORT_MAX_ENTRIES,
);

// A dry run only describes the payload it was run against, so editing the
// payload throws the result away rather than leaving a stale "safe to apply".
watch(payloadText, () => {
  dryRun.value = null;
  applied.value = null;
});

function pickFile() {
  fileInput.value?.click();
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  payloadText.value = await file.text();
  // Same file twice in a row still fires a change event this way.
  input.value = "";
}

async function run(isDryRun: boolean) {
  if (!hasPayload.value || tooManyEntries.value) {
    return;
  }
  const payload = parsed.value.value;
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: importUtilityLineupsMutation,
      variables: {
        payload,
        dry_run: isDryRun,
      },
    });
    const view = readUtilityImportOutput(
      (data as any)?.importUtilityLineups as UtilityImportOutput | undefined,
    );
    if (isDryRun) {
      dryRun.value = view;
      applied.value = null;
      return;
    }
    applied.value = view;
    toast({
      title: t("pages.settings.application.utility.import.done", {
        count: view.imported,
      }),
    });
  } catch (error: any) {
    toast({
      title: isDryRun
        ? t("pages.settings.application.utility.import.dry_run_failed")
        : t("pages.settings.application.utility.import.failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function runPurge(isDryRun: boolean) {
  const { data } = await getGraphqlClient().mutate({
    mutation: purgeUtilityLineupSourceMutation,
    variables: {
      origin_source: PURGE_SOURCE,
      dry_run: isDryRun,
    },
  });
  return readUtilityPurgeOutput(
    (data as any)?.purgeUtilityLineupSource as UtilityPurgeOutput | undefined,
  );
}

// The preview is the confirm's whole content: a purge dialog that cannot say how
// many rows it is about to take is asking for a signature on a blank page.
async function previewPurge() {
  try {
    purgePreview.value = await runPurge(true);
  } catch (error: any) {
    purgePreview.value = null;
    toast({
      title: t("pages.settings.application.utility.import.purge_preview_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function purge() {
  try {
    const result = await runPurge(false);
    purgePreview.value = null;
    dryRun.value = null;
    applied.value = null;
    toast({
      title: t("pages.settings.application.utility.import.purged", {
        count: result.lineups,
      }),
    });
  } catch (error: any) {
    toast({
      title: t("pages.settings.application.utility.import.purge_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

const results = computed(() => {
  const view = applied.value ?? dryRun.value;
  if (!view) {
    return [];
  }
  return [
    {
      key: "total",
      label: t("pages.settings.application.utility.import.total"),
      value: view.total,
      tone: "",
    },
    {
      key: "imported",
      label: t("pages.settings.application.utility.import.imported"),
      value: view.imported,
      tone: "",
    },
    {
      key: "updated",
      label: t("pages.settings.application.utility.import.updated"),
      value: view.updated,
      tone: "",
    },
    {
      key: "failed",
      label: t("pages.settings.application.utility.import.failed_count"),
      value: view.failed,
      tone: view.failed > 0 ? "text-destructive" : "",
    },
  ];
});

const shownResult = computed(() => applied.value ?? dryRun.value);
</script>

<template>
  <div class="space-y-3">
    <div class="space-y-1">
      <label
        class="font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ $t("pages.settings.application.utility.import.payload") }}
      </label>
      <p class="text-sm text-muted-foreground">
        {{ $t("pages.settings.application.utility.import.payload_description") }}
      </p>
    </div>

    <Textarea
      v-model="payloadText"
      rows="8"
      spellcheck="false"
      class="font-mono text-xs"
      :placeholder="
        $t('pages.settings.application.utility.import.payload_placeholder')
      "
    />

    <div class="flex flex-wrap items-center gap-2">
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="onFile"
      />
      <Button variant="outline" size="sm" @click="pickFile()">
        <FileUp class="mr-1 h-4 w-4" />
        {{ $t("pages.settings.application.utility.import.choose_file") }}
      </Button>

      <span
        v-if="entryCount !== null"
        class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{
          $t("pages.settings.application.utility.import.entries", {
            count: entryCount,
          })
        }}
      </span>

      <Button
        size="sm"
        variant="outline"
        class="ml-auto"
        :disabled="!hasPayload || tooManyEntries"
        @click="run(true)"
      >
        <Play class="mr-1 h-4 w-4" />
        {{ $t("pages.settings.application.utility.import.dry_run") }}
      </Button>

      <!-- The real run stays shut until a dry run has described this exact
           payload: the counts and the errors are the only preview there is. It
           shuts again once applied, so the same payload cannot be run twice
           without a fresh dry run saying what a second pass would do. -->
      <Button
        size="sm"
        class="tac-amber-cta"
        :disabled="!hasPayload || tooManyEntries || !dryRun || !!applied"
        @click="run(false)"
      >
        {{ $t("pages.settings.application.utility.import.apply") }}
      </Button>
    </div>

    <p
      v-if="parsed.invalid"
      class="text-[0.8rem] font-medium text-destructive"
    >
      {{ $t("pages.settings.application.utility.import.invalid_json") }}
    </p>

    <p
      v-if="tooManyEntries"
      class="text-[0.8rem] font-medium text-destructive"
    >
      {{
        $t("pages.settings.application.utility.import.too_many_entries", {
          max: UTILITY_IMPORT_MAX_ENTRIES,
        })
      }}
    </p>

    <p v-if="!dryRun && !applied" class="text-xs text-muted-foreground">
      {{ $t("pages.settings.application.utility.import.dry_run_first") }}
    </p>

    <div v-if="shownResult" class="space-y-2">
      <!-- The server says which kind of run this was; the button that fired it
           does not get a vote. -->
      <div
        class="font-mono text-[0.6rem] uppercase tracking-[0.16em]"
        :class="
          shownResult.dryRun ? 'text-[hsl(var(--tac-amber))]' : 'text-success'
        "
      >
        {{
          shownResult.dryRun
            ? $t("pages.settings.application.utility.import.dry_run_label")
            : $t("pages.settings.application.utility.import.applied_label")
        }}
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          v-for="result of results"
          :key="result.key"
          class="rounded-md border border-border/60 bg-card/30 px-3 py-2.5"
        >
          <div
            class="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ result.label }}
          </div>
          <div class="mt-1 text-xl font-bold tabular-nums" :class="result.tone">
            {{ result.value }}
          </div>
        </div>
      </div>

      <p v-if="shownResult.empty" class="text-xs text-muted-foreground">
        {{ $t("pages.settings.application.utility.import.nothing_in_payload") }}
      </p>

      <div v-if="shownResult.errors.length" class="space-y-1">
        <div
          class="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-destructive"
        >
          <TriangleAlert class="h-3.5 w-3.5" />
          {{
            $t("pages.settings.application.utility.import.errors", {
              count: shownResult.errors.length,
            })
          }}
        </div>
        <!-- Position first, then whatever id the entry carried: a reason with no
             way back to the offending entry is unusable at five thousand rows. -->
        <ul
          class="max-h-48 space-y-1 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/10 p-2"
        >
          <li
            v-for="(error, index) of shownResult.errors"
            :key="index"
            class="flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] leading-snug"
          >
            <span class="shrink-0 font-semibold tabular-nums">
              {{
                $t("pages.settings.application.utility.import.error_row", {
                  index: error.index,
                })
              }}
            </span>
            <span v-if="error.externalId" class="shrink-0 opacity-80">
              {{ error.externalId }}
            </span>
            <span class="min-w-0 whitespace-pre-wrap break-words">
              {{ error.reason }}
            </span>
          </li>
        </ul>

        <p
          v-if="shownResult.errorsTruncated"
          class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{
            $t("pages.settings.application.utility.import.errors_truncated", {
              shown: shownResult.errors.length,
              count: shownResult.failed,
            })
          }}
        </p>
      </div>
    </div>

    <div class="space-y-1.5 rounded-md border border-border bg-foreground/5 p-3">
      <div
        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.settings.application.utility.import.grading") }}
      </div>
      <!-- The note component already says the true thing about a lineup with no
           measured physics behind it, so the panel shows the badge itself rather
           than writing a second description of it. -->
      <UtilityConfidenceNote
        :lineup="{
          confidence: 'low',
          origin_source: 'import',
          verified_at: null,
          view_yaw_delta: null,
          view_pitch_delta: null,
        }"
      />
    </div>

    <div class="space-y-2 pt-1">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="min-w-0 flex-1 text-xs text-muted-foreground">
          {{ $t("pages.settings.application.utility.import.purge_description") }}
        </p>
        <Button variant="outline" size="sm" @click="previewPurge()">
          <Eye class="mr-1 h-4 w-4" />
          {{ $t("pages.settings.application.utility.import.purge_preview") }}
        </Button>
        <!-- Destructive only after the preview has put a number on it. -->
        <Button
          variant="destructive"
          size="sm"
          :disabled="!purgePreview || purgePreview.lineups === 0"
          @click="confirmPurge = true"
        >
          <Trash2 class="mr-1 h-4 w-4" />
          {{ $t("pages.settings.application.utility.import.purge") }}
        </Button>
      </div>

      <p
        v-if="purgePreview"
        class="text-xs"
        :class="
          purgePreview.lineups > 0
            ? 'font-medium text-destructive'
            : 'text-muted-foreground'
        "
      >
        {{
          purgePreview.lineups > 0
            ? $t(
                "pages.settings.application.utility.import.purge_preview_result",
                { count: purgePreview.lineups },
              )
            : $t("pages.settings.application.utility.import.purge_preview_empty")
        }}
      </p>
    </div>

    <AlertDialog :open="confirmPurge" @update:open="confirmPurge = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{
              $t("pages.settings.application.utility.import.confirm_purge", {
                count: purgePreview?.lineups ?? 0,
              })
            }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{
              $t(
                "pages.settings.application.utility.import.confirm_purge_description",
              )
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="confirmPurge = false">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="
              purge();
              confirmPurge = false;
            "
          >
            {{ $t("common.confirm") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
