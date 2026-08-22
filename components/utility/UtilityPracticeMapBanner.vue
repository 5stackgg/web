<script setup lang="ts">
/**
 * "Your practice server is on another map."
 *
 * Switching maps on the website used to strand the server silently: every
 * Practice button on the new map's page simply vanished, with nothing on screen
 * connecting that to the server still sitting on the old one. This is the line
 * that says so, and -- for the host -- the one click that fixes it.
 *
 * Only the host may move it, because a changelevel takes everyone else on the
 * server through a load screen too. Everybody else still gets the line: it is
 * the answer to "why can I not practise any of these".
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Repeat, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import cleanMapName from "~/utilities/cleanMapName";

const props = defineProps<{
  /** The map the page is showing, which is where the server is being asked to go. */
  mapName: string;
}>();

const { t } = useI18n();
const load = useUtilityLoad();
const { session, canManage, switching } = useUtilityPracticeSession();

const host = computed(() => session.value?.host?.name ?? null);

// Where the server is, or -- mid-switch -- where it is going. Both readings
// name the same column; which one it is depends on `switching`, which is why
// the two branches of the banner never share a sentence.
const serverMap = computed(
  () => load.where.value?.map_name ?? session.value?.map_name ?? null,
);

const mismatched = computed(
  () =>
    !!session.value &&
    !!serverMap.value &&
    serverMap.value !== props.mapName,
);

// Saying no once should hold while they browse. Keyed on both the session and
// the map so a different server, or a different map, asks again -- and kept in
// sessionStorage so it does not outlive the tab the decision was made in.
const dismissKey = computed(() =>
  session.value?.id ? `utility.map-banner.${session.value.id}.${props.mapName}` : null,
);

const dismissed = ref(false);

function readDismissed(key: string | null): boolean {
  if (!key) {
    return false;
  }
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    // Private windows and blocked site data both throw here. Asking again is
    // the harmless side of that.
    return false;
  }
}

watch(dismissKey, (key) => (dismissed.value = readDismissed(key)), {
  immediate: true,
});

function dismiss() {
  dismissed.value = true;
  try {
    if (dismissKey.value) {
      window.sessionStorage.setItem(dismissKey.value, "1");
    }
  } catch {
    // Nothing to do -- it just asks again next time.
  }
}

const visible = computed(
  () => switching.value || (mismatched.value && !dismissed.value),
);

async function switchMap() {
  await load.switchMap(props.mapName);
}
</script>

<template>
  <div
    v-if="visible"
    class="flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.07)] px-2.5 py-1.5"
  >
    <Spinner v-if="switching" class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
    <Repeat v-else class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />

    <span class="min-w-0 truncate text-xs text-muted-foreground">
      <!-- The target is the SESSION'S map, not this page's: the switch may
           have been asked for from somewhere else entirely, and naming the map
           being browsed would report the wrong destination. -->
      <template v-if="switching">
        {{
          $t("pages.utility.practice.switching", {
            map: cleanMapName(serverMap ?? ""),
          })
        }}
      </template>
      <template v-else>
        {{
          $t("pages.utility.practice.map_banner", {
            map: cleanMapName(serverMap ?? ""),
          })
        }}
        <template v-if="!canManage">
          {{
            host
              ? $t("pages.utility.practice.ask_host", { host })
              : $t("pages.utility.practice.ask_the_host")
          }}
        </template>
      </template>
    </span>

    <template v-if="!switching">
      <Button
        v-if="canManage"
        size="sm"
        variant="outline"
        class="ml-auto h-7 shrink-0 px-2 text-[0.68rem]"
        :loading="load.sending.value === `map-${mapName}`"
        @click="switchMap()"
      >
        {{ $t("pages.utility.practice.switch_map", { map: cleanMapName(mapName) }) }}
      </Button>

      <button
        type="button"
        class="shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground"
        :class="canManage ? '' : 'ml-auto'"
        :title="$t('common.close')"
        @click="dismiss()"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </template>
  </div>
</template>
