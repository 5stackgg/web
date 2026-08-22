<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RefreshCw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { remineUtilityMetaMutation } from "~/graphql/utilityGraphql";

const { t } = useI18n();

const running = ref(false);
const demos = ref(0);
const throws = ref(0);
const finished = ref(false);

// The action mines one batch per call so a scan of every demo on the install
// never sits inside a single request. Looping here is what turns that into one
// button, and it is what lets the count move while it works.
async function rescan() {
  if (running.value) {
    return;
  }

  running.value = true;
  finished.value = false;
  demos.value = 0;
  throws.value = 0;

  try {
    for (;;) {
      const { data } = await getGraphqlClient().mutate({
        mutation: remineUtilityMetaMutation,
        fetchPolicy: "no-cache",
      });

      const batch = (data as any)?.remineUtilityMeta;

      if (!batch) {
        throw new Error("no response");
      }

      demos.value += Number(batch.demos ?? 0);
      throws.value += Number(batch.throws ?? 0);

      if (batch.done === true) {
        break;
      }
    }

    finished.value = true;
    toast({
      title: t("pages.settings.application.utility.rescan_done", {
        demos: demos.value,
        throws: throws.value,
      }),
    });
  } catch (error: any) {
    toast({
      title: t("pages.settings.application.utility.rescan_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    running.value = false;
  }
}

const progress = computed(() =>
  t("pages.settings.application.utility.rescan_progress", {
    demos: demos.value,
    throws: throws.value,
  }),
);
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm text-muted-foreground">
      {{ $t("pages.settings.application.utility.rescan_description") }}
    </p>

    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" :loading="running" @click="rescan()">
        <RefreshCw class="mr-1 h-4 w-4" />
        {{ $t("pages.settings.application.utility.rescan") }}
      </Button>

      <span
        v-if="running || finished"
        class="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ progress }}
      </span>
    </div>
  </div>
</template>
