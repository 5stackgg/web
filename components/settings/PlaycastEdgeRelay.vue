<script setup lang="ts">
import { onMounted, ref } from "vue";
import { CheckCircle2, Cloud, RefreshCw, XCircle } from "lucide-vue-next";
import { Button } from "~/components/ui/button";

const relayDomain = String(useRuntimeConfig().public.relayDomain || "");

const status = ref<"checking" | "active" | "inactive">("checking");

// Only the edge relay worker answers /health on the relay domain: the panel's
// own relay has no such path, so an answer means Cloudflare is already sending
// the relay's traffic through the worker.
async function check() {
  status.value = "checking";
  try {
    const response = await fetch(`https://${relayDomain}/health`, {
      cache: "no-store",
    });
    const health = response.ok ? await response.json() : null;
    status.value =
      health?.worker === "5stack-playcast-relay" ? "active" : "inactive";
  } catch {
    status.value = "inactive";
  }
}

onMounted(() => {
  if (relayDomain) {
    check();
  } else {
    status.value = "inactive";
  }
});
</script>

<template>
  <div class="space-y-4 rounded-md border border-border/60 p-4">
    <div class="space-y-1">
      <h4 class="text-sm font-medium">
        {{ $t("pages.settings.application.streaming.relay_title") }}
      </h4>
      <p class="text-xs text-muted-foreground">
        {{ $t("pages.settings.application.streaming.relay_description") }}
      </p>
    </div>

    <div
      data-test="relay-status-row"
      class="flex flex-wrap items-center justify-between gap-3 rounded-md border-l-2 px-3 py-2 text-sm"
      :class="{
        'border-green-500 bg-gradient-to-r from-green-500/15 to-transparent text-green-300':
          status === 'active',
        'border-red-500 bg-gradient-to-r from-red-500/15 to-transparent text-red-300':
          status === 'inactive',
        'border-transparent bg-muted/30': status === 'checking',
      }"
    >
      <div class="flex min-w-0 items-center gap-2">
        <CheckCircle2
          v-if="status === 'active'"
          class="size-4 shrink-0 text-green-400"
        />
        <XCircle
          v-else-if="status === 'inactive'"
          class="size-4 shrink-0 text-red-400"
        />
        <Cloud v-else class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate" data-test="relay-status">
          {{
            $t(`pages.settings.application.streaming.relay_${status}`, {
              domain: relayDomain,
            })
          }}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :loading="status === 'checking'"
        @click="check"
      >
        <RefreshCw class="size-3.5" />
        {{ $t("pages.settings.application.streaming.relay_check_again") }}
      </Button>
    </div>

    <div v-if="status === 'inactive'" class="space-y-3 text-xs">
      <p class="text-muted-foreground">
        {{
          $t("pages.settings.application.streaming.relay_setup_proxied", {
            domain: relayDomain || "tv.example.com",
          })
        }}
      </p>
      <p class="text-muted-foreground">
        {{ $t("pages.settings.application.streaming.relay_setup_deploy") }}
      </p>
      <pre
        class="overflow-x-auto rounded-md bg-muted p-2"
      ><code>./playcast-relay.sh</code></pre>
      <a
        href="https://docs.5stack.gg/advanced/playcast-edge-relay"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block text-primary hover:underline"
      >
        {{ $t("pages.settings.application.streaming.relay_setup_guide") }}
      </a>
    </div>
  </div>
</template>
