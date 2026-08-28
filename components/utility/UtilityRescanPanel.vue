<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RefreshCw, Tags } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  remineUtilityMetaMutation,
  syncMapCalloutsMutation,
} from "~/graphql/utilityGraphql";

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

const syncing = ref(false);

// The daily job is the normal path. This is for the run right after a new
// callouts tag is published, when waiting for it means every throw named in
// between is named from the old map.
async function syncCallouts() {
  if (syncing.value) {
    return;
  }

  syncing.value = true;

  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: syncMapCalloutsMutation,
      fetchPolicy: "no-cache",
    });

    const result = (data as any)?.syncMapCallouts;

    toast({
      title: t("pages.settings.application.utility.callouts_synced", {
        maps: Number(result?.maps ?? 0),
        callouts: Number(result?.callouts ?? 0),
      }),
    });
  } catch (error: any) {
    toast({
      title: t("pages.settings.application.utility.callouts_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    syncing.value = false;
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

      <Button variant="outline" :loading="syncing" @click="syncCallouts()">
        <Tags class="mr-1 h-4 w-4" />
        {{ $t("pages.settings.application.utility.sync_callouts") }}
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
